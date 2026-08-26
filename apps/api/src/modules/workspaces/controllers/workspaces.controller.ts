import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { WorkspacesService } from '../services/workspaces.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { ChangeRoleDto } from '../dto/change-role.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { TransferOwnershipDto } from '../dto/transfer-ownership.dto';
import {
  WorkspaceResponseDto,
  WorkspaceMemberResponseDto,
  InvitationResponseDto,
  InvitationCreatedResponseDto,
  AcceptedInvitationResponseDto,
} from '../dto/workspace-response.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller({ path: 'workspaces', version: '1' })
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  public async create(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const ws = await this.workspaces.create(user.id, body);
    return toWorkspaceResponse(ws);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my workspaces' })
  @ApiOkResponse({ type: [WorkspaceResponseDto] })
  public async listMyWorkspaces(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<WorkspaceResponseDto[]> {
    const list = await this.workspaces.listByUserWithStats(user.id);
    return list.map(toWorkspaceResponse);
  }

  @Get('invitations/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my pending invitations' })
  @ApiOkResponse({ type: [InvitationResponseDto] })
  public async getMyPendingInvitations(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<InvitationResponseDto[]> {
    const list = await this.workspaces.getMyPendingInvitations(user.email);
    return list.map(toInvitationResponse);
  }

  @Get(':id')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiNotFoundResponse()
  public async getById(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<WorkspaceResponseDto> {
    const ws = await this.workspaces.getById(id, user.id);
    return toWorkspaceResponse(ws);
  }

  @Patch(':id')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update workspace' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const ws = await this.workspaces.update(id, user.id, body);
    return toWorkspaceResponse(ws);
  }

  @Post(':id/archive')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive workspace' })
  public async archive(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.workspaces.archive(id, user.id);
  }

  @Post(':id/unarchive')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unarchive workspace' })
  public async unarchive(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.workspaces.unarchive(id, user.id);
  }

  @Delete(':id')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete workspace (owner only)' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.workspaces.delete(id, user.id);
  }

  @Get(':id/members')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List workspace members' })
  @ApiOkResponse({ type: [WorkspaceMemberResponseDto] })
  public async getMembers(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    const members = await this.workspaces.getMembers(id, user.id);
    return members.map(toMemberResponse);
  }

  @Patch(':id/members/:userId/role')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change member role' })
  @ApiOkResponse({ type: WorkspaceMemberResponseDto })
  public async changeRole(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() body: ChangeRoleDto,
  ): Promise<WorkspaceMemberResponseDto> {
    const member = await this.workspaces.changeMemberRole(
      id,
      user.id,
      targetUserId,
      body.role,
    );
    return toMemberResponse(member);
  }

  @Delete(':id/members/:userId')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from workspace' })
  public async removeMember(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.workspaces.removeMember(id, user.id, targetUserId);
  }

  @Post(':id/transfer')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer workspace ownership' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  public async transferOwnership(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Body() body: TransferOwnershipDto,
  ): Promise<WorkspaceResponseDto> {
    const ws = await this.workspaces.transferOwnership(
      id,
      user.id,
      body.newOwnerId,
    );
    return toWorkspaceResponse(ws);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/invitations')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create invitation' })
  @ApiCreatedResponse({ type: InvitationCreatedResponseDto })
  public async createInvitation(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Body() body: CreateInvitationDto,
  ): Promise<InvitationCreatedResponseDto> {
    const result = await this.workspaces.createInvitation(id, user.id, body);
    return {
      token: `${result.selector}:${result.verifier}`,
      selector: result.selector,
    };
  }

  @Get(':id/invitations')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List workspace invitations' })
  @ApiOkResponse({ type: [InvitationResponseDto] })
  public async getInvitations(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<InvitationResponseDto[]> {
    const list = await this.workspaces.getInvitations(id, user.id);
    return list.map(toInvitationResponse);
  }

  @Delete(':id/invitations/:invitationId')
  @WorkspaceAccess('VIEWER', { param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke invitation' })
  public async revokeInvitation(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.workspaces.revokeInvitation(id, invitationId, user.id);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invitation (auth required)' })
  @ApiOkResponse({ type: AcceptedInvitationResponseDto })
  public async acceptInvitation(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: AcceptInvitationDto,
  ): Promise<AcceptedInvitationResponseDto> {
    const result = await this.workspaces.acceptInvitation(
      body.selector,
      body.verifier,
      user.id,
    );
    return {
      workspaceId: result.workspaceId,
      message: 'Invitation accepted. You are now a member.',
    };
  }
}

function toWorkspaceResponse(ws: {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: unknown;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number | null;
  boardCount?: number | null;
}): WorkspaceResponseDto {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    ownerId: ws.ownerId,
    status: ws.status as WorkspaceResponseDto['status'],
    description: ws.description,
    logoUrl: ws.logoUrl,
    website: ws.website,
    archivedAt: ws.archivedAt,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
    memberCount: ws.memberCount ?? 0,
    boardCount: ws.boardCount ?? 0,
  };
}

function toMemberResponse(m: {
  id: string;
  workspaceId: string;
  userId: string;
  role: unknown;
  status: unknown;
  joinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { displayName: string; email: string } | null;
}): WorkspaceMemberResponseDto {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role as WorkspaceMemberResponseDto['role'],
    status: m.status as WorkspaceMemberResponseDto['status'],
    joinedAt: m.joinedAt,
    user: m.user ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function toInvitationResponse(inv: {
  id: string;
  workspaceId: string;
  email: string;
  role: unknown;
  status: string;
  invitedById: string;
  acceptedById: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}): InvitationResponseDto {
  return {
    id: inv.id,
    workspaceId: inv.workspaceId,
    email: inv.email,
    role: inv.role as InvitationResponseDto['role'],
    status: inv.status,
    invitedById: inv.invitedById,
    acceptedById: inv.acceptedById,
    acceptedAt: inv.acceptedAt,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
  };
}
