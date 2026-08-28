import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { NotificationType } from '@repo/database';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { NotificationPreferencesService } from '../services/notification-preferences.service';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller({ path: 'users/me', version: '1' })
export class NotificationPreferencesController {
  constructor(
    @Inject(NotificationPreferencesService)
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get('notification-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my notification preferences (all types)' })
  public async get(@CurrentUser() user: CurrentUserModel): Promise<{
    preferences: Array<{
      type: string;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>;
  }> {
    const preferences = await this.preferences.getAll(user.id);
    return { preferences };
  }

  @Put('notification-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my notification preferences' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              emailEnabled: { type: 'boolean' },
              inAppEnabled: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Body()
    body: {
      preferences?: Array<{
        type: string;
        emailEnabled: boolean;
        inAppEnabled: boolean;
      }>;
    },
  ): Promise<{
    preferences: Array<{
      type: string;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>;
  }> {
    const entries = (body?.preferences ?? []).filter(
      (p) =>
        p &&
        typeof p.type === 'string' &&
        typeof p.emailEnabled === 'boolean' &&
        typeof p.inAppEnabled === 'boolean',
    );
    await this.preferences.upsert(
      user.id,
      entries.map((p) => ({
        type: p.type as NotificationType,
        emailEnabled: p.emailEnabled,
        inAppEnabled: p.inAppEnabled,
      })),
    );
    const preferences = await this.preferences.getAll(user.id);
    return { preferences };
  }
}
