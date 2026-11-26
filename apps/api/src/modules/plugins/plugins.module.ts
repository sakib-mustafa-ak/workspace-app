import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as User } from '../auth/interfaces/current-user.interface';
import { WorkspaceAccess } from '../../common/decorators/workspace-access.decorator';
import { PluginProviderService } from './plugin-provider.service';
import { PluginsService } from './plugins.service';
import { GITHUB_REPOSITORY_PATTERN } from './plugin-catalog';

export class PluginEnabledDto {
  @IsBoolean() enabled!: boolean;
}
export class PluginCompleteDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @IsString() @IsNotEmpty() @MaxLength(4096) code!: string;
}
export class PluginDataQuery {
  @IsOptional()
  @IsString()
  @Matches(GITHUB_REPOSITORY_PATTERN)
  @MaxLength(200)
  repository?: string;
}
export class SlackMessageDto {
  @IsString() @Matches(/^C[A-Z0-9]{8,}$/) @MaxLength(64) channel!: string;
  @IsString() @Matches(/\S/) @MaxLength(3000) text!: string;
}
export class VoteDto {
  @IsBoolean() voted!: boolean;
}

@Controller({ path: 'workspaces/:workspaceId/plugins', version: '1' })
@WorkspaceAccess('VIEWER')
export class PluginsController {
  constructor(
    @Inject(PluginsService) private readonly plugins: PluginsService,
  ) {}

  @Get()
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.list(workspaceId, user.id);
  }

  @Put(':key')
  @WorkspaceAccess('ADMIN')
  set(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: User,
    @Body() body: PluginEnabledDto,
  ) {
    return this.plugins.setEnabled(workspaceId, user.id, key, body.enabled);
  }

  @Post(':key/connect')
  @WorkspaceAccess('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.begin(workspaceId, user.id, key);
  }

  @Post(':key/complete')
  @WorkspaceAccess('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  complete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: User,
    @Body() body: PluginCompleteDto,
  ) {
    return this.plugins.complete(
      workspaceId,
      user.id,
      key,
      body.state,
      body.code,
    );
  }

  @Get(':key/data')
  @WorkspaceAccess('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  data(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: User,
    @Query() query: PluginDataQuery,
  ) {
    return this.plugins.providerAction(workspaceId, user.id, key, query);
  }

  @Post('slack/messages')
  @WorkspaceAccess('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
    @Body() body: SlackMessageDto,
  ) {
    return this.plugins.providerAction(workspaceId, user.id, 'slack', body);
  }

  @Get('tasks/:taskId')
  task(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.taskStatus(workspaceId, user.id, taskId);
  }

  @Put('tasks/:taskId/vote')
  vote(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
    @Body() body: VoteDto,
  ) {
    return this.plugins.vote(workspaceId, user.id, taskId, body.voted);
  }

  @Post('tasks/:taskId/timer')
  @WorkspaceAccess('EDITOR')
  start(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.startTimer(workspaceId, user.id, taskId);
  }

  @Post('timers/stop')
  stop(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.stopTimer(workspaceId, user.id);
  }

  @Get('timers/mine')
  time(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.plugins.myTime(workspaceId, user.id);
  }
}

@Module({
  controllers: [PluginsController],
  providers: [PluginsService, PluginProviderService],
})
export class PluginsModule {}
