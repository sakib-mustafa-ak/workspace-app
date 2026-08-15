import { ApiProperty } from '@nestjs/swagger';
import type { UserStatus } from '@repo/database';

export class UserProfileDto {
  @ApiProperty({ example: '018f3a…-…' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  displayName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;

  @ApiProperty({ example: null, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'Mathematician and writer.', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 'America/New_York', nullable: true })
  timezone!: string | null;

  @ApiProperty({ example: 'en-US', nullable: true })
  locale!: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status!: UserStatus;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  updatedAt!: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserProfileDto] })
  users!: UserProfileDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
