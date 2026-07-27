import { ApiProperty } from '@nestjs/swagger';
import type {
  WorkspaceStatus,
  WorkspaceRole,
  MembershipStatus,
} from '@repo/database';

export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'My Team' })
  name!: string;

  @ApiProperty({ example: 'my-team' })
  slug!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: WorkspaceStatus;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true })
  website!: string | null;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class WorkspaceMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 'EDITOR' })
  role!: WorkspaceRole;

  @ApiProperty({ example: 'ACTIVE' })
  status!: MembershipStatus;

  @ApiProperty({ nullable: true })
  joinedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class InvitationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ example: 'colleague@example.com' })
  email!: string;

  @ApiProperty({ example: 'EDITOR' })
  role!: WorkspaceRole;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty()
  invitedById!: string;

  @ApiProperty({ nullable: true })
  acceptedById!: string | null;

  @ApiProperty({ nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class InvitationCreatedResponseDto {
  @ApiProperty({
    description: 'Share this full token with the invitee: selector:verifier',
  })
  token!: string;

  @ApiProperty({ description: 'Public half for URL construction.' })
  selector!: string;
}

export class AcceptedInvitationResponseDto {
  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  message!: string;
}
