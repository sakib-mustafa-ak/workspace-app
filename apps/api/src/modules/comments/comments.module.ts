import { Module } from '@nestjs/common';

import { CommentsController } from './controllers/comments.controller';
import { CommentsEventBus } from './events/comments.events';
import { CommentPolicy } from './policies/comment.policy';
import { CommentsRepository } from './repositories/comments.repository';
import { CommentsService } from './services/comments.service';

@Module({
  controllers: [CommentsController],
  providers: [
    CommentsService,
    CommentsRepository,
    CommentPolicy,
    CommentsEventBus,
  ],
  exports: [CommentsService, CommentsEventBus],
})
export class CommentsModule {}
