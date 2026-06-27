import { ApiProperty } from '@nestjs/swagger';

import type { UserStatus } from '@repo/database';

/**
 * Token envelope returned by every successful authentication workflow.
 *
 * Clients must persist both tokens (per Part V-A "JWT Strategy"). The
 * access token is short-lived and used as `Authorization: Bearer …`,
 * the refresh token is long-lived and sent only on `/auth/refresh` and
 * `/auth/logout`. We never echo these in logs.
 */
export class AuthTokensDto {
  @ApiProperty({ description: 'Short-lived access token (JWT).' })
  accessToken!: string;

  @ApiProperty({ description: 'Lifetime of `accessToken` in seconds.' })
  accessTokenExpiresInSeconds!: number;

  @ApiProperty({
    description: 'Opaque refresh token. Send only on /auth/refresh.',
  })
  refreshToken!: string;

  @ApiProperty({ description: 'Lifetime of `refreshToken` in seconds.' })
  refreshTokenExpiresInSeconds!: number;
}

/**
 * Public-facing user shape on authentication endpoints.
 *
 * `status` carries the canonical four-value `UserStatus` enum so the
 * integer-string union stays in lock-step with the database. Anything
 * sensitive (password hash, last-login IP, etc.) is intentionally
 * omitted — see Part V-B "Users Domain".
 */
export class UserProfileDto {
  @ApiProperty({ example: '018f3a…-…' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  displayName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'],
    description: 'Mirrors `users.status` from the database.',
  })
  status!: UserStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'ISO 8601 timestamp; null until verified.',
  })
  emailVerifiedAt!: string | null;
}

/**
 * Standard envelope returned by `/auth/register`, `/auth/login`,
 * `/auth/refresh`. Documented response in Part IX.
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Stable API contract for the authenticated subject.',
  })
  user!: UserProfileDto;

  @ApiProperty({
    description:
      'Token bundle — both must be persisted by the client.',
  })
  tokens!: AuthTokensDto;
}
