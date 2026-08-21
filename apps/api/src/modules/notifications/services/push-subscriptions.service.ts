import { Inject, Injectable } from '@nestjs/common';
import { WebPushService } from './web-push.service';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';

interface WebPushError extends Error {
  statusCode: number;
}

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @Inject(PushSubscriptionsRepository)
    private readonly repo: PushSubscriptionsRepository,
    private readonly webPush: WebPushService,
  ) {}

  public async subscribe(
    userId: string,
    input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
  ): Promise<void> {
    // Check if already exists
    const existing = await this.repo.findByEndpoint(input.endpoint);
    if (existing) {
      // Update user agent if changed
      if (input.userAgent && existing.userAgent !== input.userAgent) {
        await this.repo.create({
          id: existing.id,
          userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
        });
      }
      return;
    }

    await this.repo.create({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    });
  }

  public async unsubscribe(userId: string, id?: string): Promise<void> {
    if (id) {
      await this.repo.deleteById(id, userId);
    } else {
      await this.repo.deleteAllByUser(userId);
    }
  }

  public async listByUser(userId: string) {
    return this.repo.listByUser(userId);
  }

  public async sendToUser(
    userId: string,
    payload: {
      title: string;
      body?: string;
      icon?: string;
      badge?: string;
      data?: Record<string, unknown>;
    },
  ): Promise<number> {
    const subscriptions = await this.repo.listByUser(userId);
    if (subscriptions.length === 0) return 0;

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await this.webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            title: payload.title,
            body: payload.body,
            icon: payload.icon ?? '/icon-192.png',
            badge: payload.badge ?? '/badge-72.png',
            data: payload.data,
          },
        );
        sent++;
      } catch (e) {
        // If subscription is invalid (410/404), remove it
        const err = e as WebPushError;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.repo.deleteById(sub.id, userId);
        }
      }
    }
    return sent;
  }
}
