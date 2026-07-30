import { Module } from '@nestjs/common';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { AiController } from './controllers/ai.controller';
import { GeminiAiProvider } from './providers/gemini-ai.provider';
import { MockAiProvider } from './providers/mock-ai.provider';
import { AiService } from './services/ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, GeminiAiProvider, MockAiProvider, BoardsRepository],
  exports: [AiService],
})
export class AiModule {}
