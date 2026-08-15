import { Module } from '@nestjs/common';

import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { AuditRepository } from '../audit/repositories/audit.repository';
import { UsersController } from './controllers/users.controller';
import { UsersEventBus } from './events/users.events';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    UsersEventBus,
    WorkspaceMembersRepository,
    AuditRepository,
  ],
  exports: [UsersService, UsersEventBus],
})
export class UsersModule {}
