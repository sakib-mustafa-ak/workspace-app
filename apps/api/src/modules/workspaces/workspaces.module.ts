import { Module } from '@nestjs/common';

import { WorkspacesController } from './controllers/workspaces.controller';
import { WorkspacesEventBus } from './events/workspaces.events';
import { WorkspacePolicy } from './policies/workspace.policy';
import { WorkspacesRepository } from './repositories/workspaces.repository';
import { WorkspaceMembersRepository } from './repositories/workspace-members.repository';
import { InvitationsRepository } from './repositories/invitations.repository';
import { WorkspacesService } from './services/workspaces.service';

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspacesRepository,
    WorkspaceMembersRepository,
    InvitationsRepository,
    WorkspacePolicy,
    WorkspacesEventBus,
  ],
  exports: [WorkspacesService, WorkspacesEventBus],
})
export class WorkspacesModule {}
