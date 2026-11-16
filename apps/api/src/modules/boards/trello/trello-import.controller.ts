import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDefined, IsObject } from 'class-validator';
import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as User } from '../../auth/interfaces/current-user.interface';
import { TrelloImportService } from './trello-import.service';

export class TrelloImportDto {
  @IsDefined()
  @IsObject()
  board!: Record<string, unknown>;
}

@ApiTags('Boards')
@ApiBearerAuth()
@WorkspaceAccess('EDITOR')
@Controller({ path: 'workspaces/:workspaceId/boards/trello', version: '1' })
export class TrelloImportController {
  constructor(
    @Inject(TrelloImportService) private readonly trello: TrelloImportService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Preview a Trello JSON board import without saving',
  })
  preview(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() body: TrelloImportDto,
  ) {
    return this.trello.preview(workspaceId, user.id, body.board);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import a Trello JSON export as a new board' })
  importBoard(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() body: TrelloImportDto,
  ) {
    return this.trello.importBoard(workspaceId, user.id, body.board);
  }
}
