import { Injectable } from '@nestjs/common';
import webpush, { type PushSubscription } from 'web-push';

interface WebPushOptions {
  TTL?: number;
  topic?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

@Injectable()
export class WebPushService {
  private configured = false;
  private config: WebPushConfig;

  constructor() {
    this.config = {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
      vapidSubject:
        process.env.VAPID_SUBJECT || 'mailto:admin@workspace-os.dev',
    };
  }

  public configure(): void {
    if (!this.config.vapidPublicKey || !this.config.vapidPrivateKey) {
      console.warn(
        '[WebPush] VAPID keys not configured - push notifications disabled',
      );
      return;
    }

    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey,
    );
    this.configured = true;
  }

  public async sendNotification(
    subscription: Pick<PushSubscription, 'endpoint' | 'keys'>,
    payload: {
      title: string;
      body?: string;
      icon?: string;
      badge?: string;
      data?: Record<string, unknown>;
    },
    options: WebPushOptions = {},
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('WebPush not configured - missing VAPID keys');
    }

    const pushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      options,
    );
  }

  public getPublicKey(): string {
    return this.config.vapidPublicKey;
  }

  public isConfigured(): boolean {
    return this.configured;
  }
}
