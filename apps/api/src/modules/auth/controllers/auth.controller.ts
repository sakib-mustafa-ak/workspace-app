import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import type { CurrentUser as CurrentUserModel } from '../interfaces/current-user.interface';
import {
  AuthResponseDto,
  UserProfileDto,
} from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import { RequestVerificationDto } from '../dto/request-verification.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthService } from '../services/auth.service';
import { EmailVerificationService } from '../services/email-verification.service';

/**
 * Transport-layer controller for the Authentication bounded context.
 *
 * The blueprint (Part V-A, Part IX) is explicit:
 *  - Endpoints describe **business capabilities**, not database rows.
 *  - Controllers stay thin: validate, call service, return DTO.
 *  - Token / session / event decisions live in `AuthService`.
 *  - Public routes opt out of the global JWT guard with `@Public()`;
 *    the protected route lets the global guard populate `request.user`.
 *
 * Errors come back through `BusinessExceptionFilter`; the global filter
 * already maps `AuthException` codes to the standard error envelope.
 */
@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /**
   * Begin a brand-new account, identity and first session in one go.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates the user, the email identity, and the first refresh session in a single transaction.',
  })
  @ApiCreatedResponse({
    description: 'Account created.',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists.',
  })
  @ApiUnauthorizedResponse({ description: 'Required headers missing.' })
  public async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.register({
      displayName: body.displayName,
      email: body.email,
      password: body.password,
      meta: clientMetaFrom(request),
    });
    return toAuthResponse(result);
  }

  /**
   * Verify credentials, issue tokens and a session row.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login' })
  @ApiOkResponse({
    description: 'Authenticated.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Credentials are invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Account is suspended or deleted.',
  })
  public async login(
    @Body() body: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login({
      email: body.email,
      password: body.password,
      meta: clientMetaFrom(request),
    });
    return toAuthResponse(result);
  }

  /**
   * Rotate the refresh token. Always issues a fresh access/refresh pair
   * and revokes the previous refresh token regardless of outcome.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  @ApiOkResponse({
    description: 'Tokens refreshed.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid, revoked, or expired.',
  })
  public async refresh(
    @Body() body: RefreshDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.refresh({
      refreshToken: body.refreshToken,
      meta: clientMetaFrom(request),
    });
    return toAuthResponse(result);
  }

  /**
   * Best-effort logout: revokes the session owning the supplied refresh
   * token. Returns 204 unconditionally to avoid leaking token validity.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revokes the refresh session if one matches. Idempotent; returns 204 in all cases to avoid revealing whether a token was ever valid.',
  })
  @ApiNoContentResponse({ description: 'Logout acknowledged.' })
  public async logout(@Body() body: RefreshDto): Promise<void> {
    await this.auth.logout({ refreshToken: body.refreshToken });
  }

  /**
   * Issue a fresh verification email for the supplied address.
   *
   * Returns 202 in every legitimate case to avoid leaking whether an
   * account exists (Part IX-API Standards). The mail is dispatched
   * through the configured `MailProvider`. The flow deliberately
   * accepts the email in the body rather than reading from the JWT
   * since the link is for the address the user typed in — Part V-A
   * "Email Verification" flow step 1.
   */
  @Public()
  @Post('request-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request an email verification link',
  })
  @ApiAcceptedResponse({ description: 'Request accepted.' })
  public async requestVerification(
    @Body() body: RequestVerificationDto,
  ): Promise<void> {
    await this.emailVerification.requestVerificationForEmail(body.email);
  }

  /**
   * Resolve a verification token (selector.verifier) into the matching
   * user and mark their email verified. The flow is public so a click
   * straight from the email link works without an existing session.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address from a token link' })
  @ApiOkResponse({
    description: 'Email verified.',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
      },
    },
  })
  @ApiGoneResponse({
    description: 'Token expired or already consumed.',
  })
  @ApiConflictResponse({
    description: 'Verification could not be completed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Verification token is malformed or unknown.',
  })
  public async verifyEmail(
    @Body() body: VerifyEmailDto,
  ): Promise<{ userId: string; email: string }> {
    return this.emailVerification.verify({ token: body.token });
  }

  /**
   * Return the authenticated subject. Pulled fresh from the DB on every
   * call so status changes propagate immediately (no stale-cache risk).
   *
   * Authentication is enforced at the module level by `JwtAuthGuard`,
   * which populates `request.user`. The `@CurrentUser()` decorator
   * reads that context, so no per-method `@UseGuards()` is required.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiOkResponse({
    description: 'Current user profile.',
    type: UserProfileDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  public async me(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<UserProfileDto> {
    const fresh = await this.auth.loadCurrentUser(user.id);
    return {
      id: fresh.id,
      displayName: fresh.displayName,
      email: fresh.email,
      status: fresh.status,
      emailVerifiedAt: null, // Surface area for the email-verification flow added later.
    };
  }
}

// ───────────────────────────────────────────────────────────────────────
// Pure helpers — kept here so this file owns transport-shape choices;
// `AuthService` never imports from this module.
// ───────────────────────────────────────────────────────────────────────

/**
 * Best-effort extraction of connection metadata so audit-logging later
 * has IP + UA. Both fields stay nullable; auth must never block on
 * missing headers (proxies strip `X-Forwarded-For`, mobile clients
 * may omit User-Agent, etc.).
 *
 * `request.socket.remoteAddress` is the raw socket peer; once a
 * trusted reverse proxy is in front of the API it should set
 * `trust proxy` on the Express app and standard `request.ip` will
 * be wired up. Until then the leftmost `X-Forwarded-For` is the
 * safest signal that survives one proxy hop.
 */
function clientMetaFrom(
  request: Request,
): { ip: string | null; userAgent: string | null } {
  const ipHeader = request.headers['x-forwarded-for'];
  const rawSocketIp = request.socket?.remoteAddress ?? null;
  const ip = typeof ipHeader === 'string'
    ? ipHeader.split(',')[0]!.trim()
    : rawSocketIp;
  const uaHeader = request.headers['user-agent'];
  const userAgent = typeof uaHeader === 'string' ? uaHeader : null;
  return { ip: ip ?? null, userAgent };
}

/**
 * Shape the canonical service result into the published `AuthResponseDto`.
 *
 * Decoupling lets the service move fields around freely (e.g. add a
 * multi-tenant claim without touching controllers).
 */
function toAuthResponse(
  result: Awaited<ReturnType<AuthService['register']>>,
): AuthResponseDto {
  return {
    user: {
      id: result.user.id,
      displayName: result.user.displayName,
      email: result.user.email,
      status: result.user.status,
      emailVerifiedAt: result.user.emailVerifiedAt
        ? result.user.emailVerifiedAt.toISOString()
        : null,
    },
    tokens: {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds:
        result.tokens.accessTokenExpiresInSeconds,
      refreshToken: result.tokens.refreshToken,
      refreshTokenExpiresInSeconds:
        result.tokens.refreshTokenExpiresInSeconds,
    },
  };
}
