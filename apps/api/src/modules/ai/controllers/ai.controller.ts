import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from '../services/ai.service';
import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';

@ApiTags('AI')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post('boards/:boardId/summarize')
  @WorkspaceAccess('VIEWER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI summary of board tasks' })
  public async summarizeBoard(@Param('boardId') boardId: string) {
    return this.aiService.summarizeBoard(boardId);
  }

  @Post('ideas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI sticky note ideas for topic' })
  public async generateIdeas(@Body() body: { topic: string; count?: number }) {
    return this.aiService.generateIdeas(
      body.topic || 'Workspace Ideas',
      body.count || 4,
    );
  }
}
