import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { PushSubscriptionsService } from '../services/push-subscriptions.service';
import { WebPushService } from '../services/web-push.service';

@ApiTags('Push Subscriptions')
@ApiBearerAuth()
@Controller({ path: 'push-subscriptions', version: '1' })
export class PushSubscriptionsController {
  constructor(
    @Inject(PushSubscriptionsService)
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly webPush: WebPushService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  public async subscribe(
    @CurrentUser() user: CurrentUserModel,
    @Body()
    body: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
  ): Promise<{ success: boolean }> {
    await this.pushSubscriptions.subscribe(user.id, body);
    return { success: true };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List push subscriptions' })
  public async list(@CurrentUser() user: CurrentUserModel) {
    const subscriptions = await this.pushSubscriptions.listByUser(user.id);
    return subscriptions.map((s) => ({
      id: s.id,
      endpoint: s.endpoint,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
    }));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from all push notifications' })
  public async unsubscribeAll(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<void> {
    await this.pushSubscriptions.unsubscribe(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from push notification by ID' })
  public async unsubscribe(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.pushSubscriptions.unsubscribe(user.id, id);
  }

  @Get('vapid-public-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get VAPID public key for client subscription' })
  public getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.webPush.getPublicKey() };
  }
}
