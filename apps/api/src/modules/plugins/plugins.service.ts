import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  desc,
  DATABASE,
  eq,
  gt,
  isNull,
  lt,
  accountPluginOauthStates,
  sql,
  tasks,
  taskTimeEntries,
  taskVotes,
  workspaceMembers,
  accountPlugins,
  type Db,
  type DbExecutor,
} from '@repo/database';
import { createHash, randomBytes } from 'node:crypto';
import { BoardAccessService } from '../../common/board-access/board-access.service';
import { PLUGIN_CATALOG, isProvider } from './plugin-catalog';
import { decryptTokens, encryptTokens } from './plugin-crypto';
import { PluginProviderService, type Tokens } from './plugin-provider.service';

@Injectable()
export class PluginsService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PluginProviderService)
    private readonly providers: PluginProviderService,
    @Inject(BoardAccessService) private readonly access: BoardAccessService,
  ) {}

  private definition(key: string) {
    const definition = PLUGIN_CATALOG.find((plugin) => plugin.key === key);
    if (!definition) throw new NotFoundException('Plugin not found.');
    if (definition.category === 'custom')
      throw new BadRequestException('Custom extensions are coming soon.');
    return definition;
  }

  private async member(workspaceId: string, userId: string) {
    const [member] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!member) throw new ForbiddenException('Workspace access denied.');
    return member;
  }

  async list(workspaceId: string | null, userId: string) {
    if (workspaceId) await this.member(workspaceId, userId);
    const installed = await this.db
      .select({
        key: accountPlugins.key,
        enabled: accountPlugins.enabled,
        connectedBy: accountPlugins.userId,
        connected: sql<boolean>`${accountPlugins.credentials} IS NOT NULL`,
      })
      .from(accountPlugins)
      .where(eq(accountPlugins.userId, userId));
    return {
      canManage: true,
      plugins: PLUGIN_CATALOG.map((plugin) => {
        const entry = installed.find((item) => item.key === plugin.key);
        return {
          ...plugin,
          available: isProvider(plugin.key)
            ? this.providers.ready(plugin.key)
            : plugin.category !== 'custom',
          enabled: Boolean(entry?.enabled),
          connected: Boolean(entry?.connected),
          ownedConnection: entry?.connectedBy === userId,
        };
      }),
    };
  }

  private async lock(tx: DbExecutor, userId: string, key: string) {
    await tx
      .insert(accountPlugins)
      .values({ userId, key })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(accountPlugins)
      .where(
        and(eq(accountPlugins.userId, userId), eq(accountPlugins.key, key)),
      )
      .for('update');
    return row;
  }

  async setEnabled(
    workspaceId: string | null,
    userId: string,
    key: string,
    enabled: boolean,
  ) {
    const definition = this.definition(key);
    if (workspaceId) await this.member(workspaceId, userId);
    if (definition.category === 'integration' && enabled)
      throw new BadRequestException(
        'Use Connect to authorize this integration.',
      );
    await this.db.transaction(async (tx) => {
      await this.lock(tx, userId, key);
      await tx
        .update(accountPlugins)
        .set({
          enabled,
          ...(isProvider(key)
            ? { credentials: null, credentialsContext: null }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(accountPlugins.userId, userId), eq(accountPlugins.key, key)),
        );
      await tx
        .delete(accountPluginOauthStates)
        .where(
          and(
            eq(accountPluginOauthStates.userId, userId),
            eq(accountPluginOauthStates.provider, key),
          ),
        );
      if (key === 'time-tracking' && !enabled)
        await tx
          .update(taskTimeEntries)
          .set({ endedAt: sql`GREATEST(now(), ${taskTimeEntries.startedAt})` })
          .where(
            and(
              eq(taskTimeEntries.userId, userId),
              isNull(taskTimeEntries.endedAt),
            ),
          );
    });
    return { enabled };
  }

  async begin(workspaceId: string | null, userId: string, key: string) {
    if (!isProvider(key))
      throw new BadRequestException('Choose a supported integration.');
    if (workspaceId) await this.member(workspaceId, userId);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const url = this.providers.authorizationUrl(key, state, verifier);
    await this.db.transaction(async (tx) => {
      const entry = await this.lock(tx, userId, key);
      if (entry.credentials)
        throw new ConflictException(
          'Disconnect the existing account before connecting another.',
        );
      await tx
        .delete(accountPluginOauthStates)
        .where(lt(accountPluginOauthStates.expiresAt, new Date()));
      await tx
        .delete(accountPluginOauthStates)
        .where(
          and(
            eq(accountPluginOauthStates.userId, userId),
            eq(accountPluginOauthStates.provider, key),
          ),
        );
      await tx.insert(accountPluginOauthStates).values({
        hash: createHash('sha256').update(state).digest('hex'),
        userId,
        provider: key,
        verifier,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
    });
    return { url, state };
  }

  private encryptionKey() {
    const key = this.config.get<string>('plugins.encryptionKey');
    if (!key)
      throw new ServiceUnavailableException(
        'Plugin encryption is not configured.',
      );
    return key;
  }

  async complete(
    workspaceId: string | null,
    userId: string,
    key: string,
    state: string,
    code: string,
  ) {
    if (!isProvider(key))
      throw new BadRequestException('Choose a supported integration.');
    if (workspaceId) await this.member(workspaceId, userId);
    const result = await this.db.transaction(async (tx) => {
      const entry = await this.lock(tx, userId, key);
      if (entry.credentials)
        throw new ConflictException(
          'This integration is already connected. Disconnect it before starting again.',
        );
      const [pending] = await tx
        .delete(accountPluginOauthStates)
        .where(
          and(
            eq(
              accountPluginOauthStates.hash,
              createHash('sha256').update(state).digest('hex'),
            ),
            eq(accountPluginOauthStates.userId, userId),
            eq(accountPluginOauthStates.provider, key),
            gt(accountPluginOauthStates.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!pending)
        throw new BadRequestException(
          'Connection request expired or was already used. Start again from Plugins.',
        );
      let tokens: Tokens;
      try {
        tokens = await this.providers.exchange(key, code, pending.verifier);
      } catch (error: unknown) {
        return { error };
      }
      await tx
        .update(accountPlugins)
        .set({
          enabled: true,
          credentials: encryptTokens(
            tokens,
            this.encryptionKey(),
            `account:${userId}:${key}`,
          ),
          credentialsContext: `account:${userId}:${key}`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(accountPlugins.userId, userId), eq(accountPlugins.key, key)),
        );
      return { connected: true };
    });
    if ('error' in result) throw result.error;
    return result;
  }

  async providerAction(
    workspaceId: string | null,
    userId: string,
    key: string,
    action: { repository?: string; channel?: string; text?: string } = {},
  ) {
    if (!isProvider(key))
      throw new BadRequestException('Choose a supported integration.');
    if (workspaceId) await this.member(workspaceId, userId);
    const result = await this.db.transaction(async (tx) => {
      const entry = await this.lock(tx, userId, key);
      if (!entry.enabled || !entry.credentials || entry.userId !== userId)
        throw new ForbiddenException(
          'Connect your account before using this integration.',
        );
      let tokens: Tokens;
      try {
        tokens = decryptTokens<Tokens>(
          entry.credentials,
          this.encryptionKey(),
          entry.credentialsContext ?? `account:${userId}:${key}`,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Could not decrypt this connection. Disconnect and reconnect it.',
        );
      }
      tokens = await this.providers.refresh(key, tokens);
      await tx
        .update(accountPlugins)
        .set({
          credentials: encryptTokens(
            tokens,
            this.encryptionKey(),
            `account:${userId}:${key}`,
          ),
          credentialsContext: `account:${userId}:${key}`,
          updatedAt: new Date(),
        })
        .where(eq(accountPlugins.id, entry.id));
      // Commit rotated tokens even when the subsequent API operation fails.
      // Rolling back here would lose a newly rotated refresh token.
      try {
        const data =
          action.channel && action.text && key === 'slack'
            ? await this.providers.sendMessage(
                tokens,
                action.channel,
                action.text,
              )
            : await this.providers.data(key, tokens, action.repository);
        return { data };
      } catch (error: unknown) {
        return { error };
      }
    });
    if ('error' in result) throw result.error;
    return result.data;
  }

  private async task(workspaceId: string, userId: string, taskId: string) {
    await this.member(workspaceId, userId);
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.workspaceId, workspaceId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    if (!task) throw new NotFoundException('Task not found.');
    const entry = await this.access.require(task.boardId, userId, workspaceId);
    return entry;
  }

  async taskStatus(workspaceId: string, userId: string, taskId: string) {
    const entry = await this.task(workspaceId, userId, taskId);
    const enabled = await this.db
      .select({ key: accountPlugins.key })
      .from(accountPlugins)
      .where(
        and(
          eq(accountPlugins.userId, userId),
          eq(accountPlugins.enabled, true),
        ),
      );
    const voting = enabled.some((plugin) => plugin.key === 'task-voting');
    const tracking = enabled.some((plugin) => plugin.key === 'time-tracking');
    const [votes] = voting
      ? await this.db
          .select({
            total: sql<number>`count(*)::int`,
            voted: sql<boolean>`COALESCE(bool_or(${taskVotes.userId} = ${userId}), false)`,
          })
          .from(taskVotes)
          .where(eq(taskVotes.taskId, taskId))
      : [];
    const [time] = tracking
      ? await this.db
          .select({
            seconds: sql<number>`COALESCE(sum(extract(epoch FROM (COALESCE(${taskTimeEntries.endedAt}, now()) - ${taskTimeEntries.startedAt}))), 0)::float8`,
          })
          .from(taskTimeEntries)
          .where(
            and(
              eq(taskTimeEntries.taskId, taskId),
              eq(taskTimeEntries.userId, userId),
            ),
          )
      : [];
    const [running] = await this.db
      .select({ taskId: taskTimeEntries.taskId })
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.workspaceId, workspaceId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .limit(1);
    return {
      voting,
      tracking,
      canTrack: ['EDITOR', 'ADMIN', 'OWNER'].includes(entry.role),
      votes: votes?.total ?? 0,
      voted: votes?.voted ?? false,
      seconds: Math.max(0, Math.floor(time?.seconds ?? 0)),
      runningTaskId: running?.taskId ?? null,
    };
  }

  async vote(
    workspaceId: string,
    userId: string,
    taskId: string,
    voted: boolean,
  ) {
    await this.task(workspaceId, userId, taskId);
    await this.db.transaction(async (tx) => {
      const plugin = await this.lock(tx, userId, 'task-voting');
      if (!plugin.enabled)
        throw new ForbiddenException('Task voting is disabled.');
      if (voted)
        await tx
          .insert(taskVotes)
          .values({ taskId, userId })
          .onConflictDoNothing();
      else
        await tx
          .delete(taskVotes)
          .where(
            and(eq(taskVotes.taskId, taskId), eq(taskVotes.userId, userId)),
          );
    });
    return { voted };
  }

  async startTimer(workspaceId: string, userId: string, taskId: string) {
    const entry = await this.task(workspaceId, userId, taskId);
    if (!['EDITOR', 'ADMIN', 'OWNER'].includes(entry.role))
      throw new ForbiddenException('An editor role is required to track time.');
    return this.db.transaction(async (tx) => {
      const plugin = await this.lock(tx, userId, 'time-tracking');
      if (!plugin.enabled)
        throw new ForbiddenException('Time tracking is disabled.');
      const [running] = await tx
        .select()
        .from(taskTimeEntries)
        .where(
          and(
            eq(taskTimeEntries.workspaceId, workspaceId),
            eq(taskTimeEntries.userId, userId),
            isNull(taskTimeEntries.endedAt),
          ),
        )
        .limit(1);
      if (running && running.taskId !== taskId)
        throw new ConflictException('Stop your other task timer first.');
      if (running) return { running: true };
      await tx.insert(taskTimeEntries).values({ workspaceId, userId, taskId });
      return { running: true };
    });
  }

  async stopTimer(workspaceId: string | null, userId: string) {
    if (workspaceId) await this.member(workspaceId, userId);
    await this.db
      .update(taskTimeEntries)
      .set({ endedAt: sql`GREATEST(now(), ${taskTimeEntries.startedAt})` })
      .where(
        and(
          workspaceId
            ? eq(taskTimeEntries.workspaceId, workspaceId)
            : undefined,
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      );
    return { running: false };
  }

  async myTime(workspaceId: string | null, userId: string) {
    if (workspaceId) await this.member(workspaceId, userId);
    // Do not expose task names or board IDs here: access may have been revoked.
    return this.db
      .select({
        id: taskTimeEntries.id,
        startedAt: taskTimeEntries.startedAt,
        endedAt: taskTimeEntries.endedAt,
      })
      .from(taskTimeEntries)
      .where(
        and(
          workspaceId
            ? eq(taskTimeEntries.workspaceId, workspaceId)
            : undefined,
          eq(taskTimeEntries.userId, userId),
        ),
      )
      .orderBy(
        sql`${taskTimeEntries.endedAt} IS NULL DESC`,
        desc(taskTimeEntries.startedAt),
      )
      .limit(100);
  }
}
