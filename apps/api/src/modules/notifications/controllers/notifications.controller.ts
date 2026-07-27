import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { NotificationsService } from '../services/notifications.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my notifications' })
  @ApiOkResponse({ type: [NotificationResponseDto] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  public async list(
    @CurrentUser() user: CurrentUserModel,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<NotificationResponseDto[]> {
    const list = await this.notifications.list(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return list.map(toNotificationResponse);
  }

  @Get('unread/count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Count unread notifications' })
  public async countUnread(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<{ count: number }> {
    return this.notifications.countUnread(user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse()
  public async getById(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notifications.getById(id, user.id);
    return toNotificationResponse(notification);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  public async markAsRead(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notifications.markAsRead(id, user.id);
    return toNotificationResponse(notification);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  public async markAllAsRead(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<void> {
    await this.notifications.markAllAsRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive notification' })
  public async archive(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notifications.archive(id, user.id);
  }
}

function toNotificationResponse(n: {
  id: string;
  userId: string;
  type: unknown;
  channel: string;
  status: unknown;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: Date | null;
  deliveredAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}): NotificationResponseDto {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type as NotificationResponseDto['type'],
    channel: n.channel,
    status: n.status as NotificationResponseDto['status'],
    title: n.title,
    body: n.body,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    readAt: n.readAt,
    deliveredAt: n.deliveredAt,
    archivedAt: n.archivedAt,
    createdAt: n.createdAt,
  };
}
