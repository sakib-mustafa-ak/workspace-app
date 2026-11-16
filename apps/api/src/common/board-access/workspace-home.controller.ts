import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import type { CurrentUser as User } from '../../modules/auth/interfaces/current-user.interface';
import { WorkspaceAccess } from '../decorators/workspace-access.decorator';
import { BoardAccessService } from './board-access.service';
import { WorkspaceHomeService } from './workspace-home.service';

class HomeQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  offset = 0;
}
class BoardAccessDto {
  @IsIn(['workspace', 'restricted']) mode!: 'workspace' | 'restricted';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  userIds: string[] = [];
}

@WorkspaceAccess('VIEWER')
@Controller({ path: 'workspaces/:workspaceId', version: '1' })
export class WorkspaceHomeController {
  constructor(
    private readonly home: WorkspaceHomeService,
    private readonly access: BoardAccessService,
  ) {}
  @Get('home')
  get(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Query() query: HomeQuery,
  ) {
    return this.home.get(workspaceId, user.id, query.offset);
  }
  @Get('boards/:boardId/access')
  @WorkspaceAccess('ADMIN')
  getAccess(
    @Param('workspaceId') workspaceId: string,
    @Param('boardId') boardId: string,
    @CurrentUser() user: User,
  ) {
    return this.access.get(boardId, user.id, workspaceId);
  }
  @Put('boards/:boardId/access')
  @WorkspaceAccess('ADMIN')
  setAccess(
    @Param('workspaceId') workspaceId: string,
    @Param('boardId') boardId: string,
    @CurrentUser() user: User,
    @Body() body: BoardAccessDto,
  ) {
    return this.access.set(
      boardId,
      user.id,
      workspaceId,
      body.mode === 'workspace' ? null : (body.userIds ?? []),
    );
  }
}
