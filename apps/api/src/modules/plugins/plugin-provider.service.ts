import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { GITHUB_REPOSITORY_PATTERN, type Provider } from './plugin-catalog';

export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  ok?: boolean;
  error?: unknown;
  scope?: string;
};
type ProviderConfig = { clientId?: string; clientSecret?: string };

@Injectable()
export class PluginProviderService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private settings(provider: Provider): ProviderConfig {
    return (
      this.config.get<ProviderConfig>(
        `plugins.${provider === 'google-calendar' ? 'google' : provider}`,
      ) ?? {}
    );
  }

  ready(provider: Provider) {
    const settings = this.settings(provider);
    return Boolean(
      settings.clientId &&
      settings.clientSecret &&
      this.config.get('plugins.encryptionKey'),
    );
  }

  private redirectUri(provider: Provider) {
    const origin = this.config.get<string>('app.publicBaseUrl')!;
    return new URL(`/plugins/callback/${provider}`, origin).href;
  }

  authorizationUrl(provider: Provider, state: string, verifier: string) {
    if (!this.ready(provider))
      throw new ServiceUnavailableException(
        'This integration needs server configuration.',
      );
    const url = new URL(
      provider === 'github'
        ? 'https://github.com/login/oauth/authorize'
        : provider === 'slack'
          ? 'https://slack.com/oauth/v2/authorize'
          : 'https://accounts.google.com/o/oauth2/v2/auth',
    );
    url.searchParams.set('client_id', this.settings(provider).clientId!);
    url.searchParams.set('redirect_uri', this.redirectUri(provider));
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      provider === 'slack'
        ? 'channels:read,chat:write'
        : provider === 'google-calendar'
          ? 'https://www.googleapis.com/auth/calendar.events.readonly'
          : '',
    );
    if (provider !== 'slack') {
      url.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    }
    if (provider === 'google-calendar') {
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
    }
    return url.href;
  }

  private async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Provider rejected request');
      const data = (await response.json()) as T & {
        ok?: boolean;
        error?: unknown;
      };
      if (!data || data.error || data.ok === false)
        throw new Error('Provider rejected request');
      return data;
    } catch {
      // Provider error bodies can contain tokens or submitted message text.
      throw new BadGatewayException(
        'The provider could not complete this request. Check permissions, rate limits or reconnect your account.',
      );
    }
  }

  private async tokenRequest(
    provider: Provider,
    fields: Record<string, string>,
  ): Promise<Tokens> {
    if (!this.ready(provider))
      throw new ServiceUnavailableException(
        'This integration needs server configuration.',
      );
    const settings = this.settings(provider);
    const result = await this.json<TokenResponse>(
      provider === 'github'
        ? 'https://github.com/login/oauth/access_token'
        : provider === 'slack'
          ? 'https://slack.com/api/oauth.v2.access'
          : 'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: settings.clientId!,
          client_secret: settings.clientSecret!,
          ...fields,
        }),
      },
    );
    if (!result.access_token)
      throw new BadGatewayException(
        'The provider did not return an access token.',
      );
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt: result.expires_in
        ? Date.now() + result.expires_in * 1000
        : undefined,
    };
  }

  exchange(provider: Provider, code: string, verifier: string) {
    return this.tokenRequest(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(provider),
      ...(provider !== 'slack' ? { code_verifier: verifier } : {}),
    });
  }

  async refresh(provider: Provider, tokens: Tokens) {
    if (!tokens.expiresAt || tokens.expiresAt > Date.now() + 60_000)
      return tokens;
    if (!tokens.refreshToken)
      throw new ServiceUnavailableException(
        'This connection has expired. Reconnect your account.',
      );
    const refreshed = await this.tokenRequest(provider, {
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    });
    return {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    };
  }

  async data(provider: Provider, tokens: Tokens, repository?: string) {
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'Workspace-OS',
    };
    if (provider === 'github') {
      if (repository) {
        if (!GITHUB_REPOSITORY_PATTERN.test(repository))
          throw new BadGatewayException('Choose a valid repository.');
        // Explicitly reject private repositories even if the user previously
        // granted this OAuth app broader permissions outside Workspace OS.
        const repo = await this.json<{ private: boolean }>(
          `https://api.github.com/repos/${repository}`,
          { headers },
        );
        if (repo.private !== false)
          throw new BadGatewayException(
            'Only public repositories are supported.',
          );
        const issues = await this.json<
          Array<{
            id: number;
            title: string;
            html_url: string;
            pull_request?: unknown;
          }>
        >(
          `https://api.github.com/repos/${repository}/issues?state=open&per_page=30`,
          { headers },
        );
        return issues
          .filter((issue) => !issue.pull_request)
          .map((issue) => ({
            id: String(issue.id),
            title: issue.title,
            url: issue.html_url,
          }));
      }
      const repos = await this.json<
        Array<{
          id: number;
          full_name: string;
          html_url: string;
          private: boolean;
        }>
      >(
        'https://api.github.com/user/repos?visibility=public&sort=updated&per_page=30',
        { headers },
      );
      return repos
        .filter((repo) => !repo.private)
        .map((repo) => ({
          id: String(repo.id),
          title: repo.full_name,
          url: repo.html_url,
        }));
    }
    if (provider === 'slack') {
      const response = await this.json<{
        channels: Array<{ id: string; name: string; is_member: boolean }>;
      }>(
        'https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=100',
        { headers },
      );
      return response.channels.map((channel) => ({
        id: channel.id,
        title: `#${channel.name}`,
        canSend: channel.is_member,
      }));
    }
    const url = new URL(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    url.search = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '30',
    }).toString();
    const response = await this.json<{
      items?: Array<{
        id: string;
        summary?: string;
        htmlLink?: string;
        start?: { dateTime?: string; date?: string };
      }>;
    }>(url.href, { headers });
    return (response.items ?? []).map((event) => ({
      id: event.id,
      title: event.summary ?? 'Untitled event',
      url: event.htmlLink,
      startsAt: event.start?.dateTime ?? event.start?.date,
    }));
  }

  async sendMessage(tokens: Tokens, channel: string, text: string) {
    await this.json('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        mrkdwn: false,
        parse: 'none',
        link_names: false,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    return { sent: true };
  }
}
