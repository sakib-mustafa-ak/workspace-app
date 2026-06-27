import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';

import {
  AccessTokenPayload,
  JWT_ACCESS_PAYLOAD_VERSION,
  RefreshTokenPayload,
} from '../interfaces/jwt-payload.interface';

/**
 * Symmetric-issuer JWT helper.
 *
 * Why `jose`? It is a Single-File dependency that lives happily under
 * the Edge runtime, supports constant-time comparison, and keeps us
 * clear of the brittle `jsonwebtoken` ecosystem. Two algorithms, two
 * secrets, one interface.
 *
 * Tokens carry an opinionated `v` field. If we ever need to switch
 * algorithms or rotate claims, mint the new ones with `v: 2` and let
 * the verifier negotiate per-version — never break older clients
 * silently.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(configService: ConfigService) {
    const accessSecret = configService.getOrThrow<string>(
      'auth.jwt.access.secret',
    );
    const refreshSecret = configService.getOrThrow<string>(
      'auth.jwt.refresh.secret',
    );

    this.accessSecret = new TextEncoder().encode(accessSecret);
    this.refreshSecret = new TextEncoder().encode(refreshSecret);

    this.accessTtl = configService.getOrThrow<number>(
      'auth.jwt.access.ttlSeconds',
    );
    this.refreshTtl = configService.getOrThrow<number>(
      'auth.jwt.refresh.ttlSeconds',
    );
  }

  /**
   * Mint a short-lived access token. We deliberately keep its claim
   * set tiny — anything dynamic belongs in a separate lookup, never
   * inside the JWT.
   */
  public async signAccessToken(payload: {
    sub: string;
    role?: 'USER' | 'ADMIN';
  }): Promise<{ token: string; expiresInSeconds: number }> {
    const body: AccessTokenPayload = {
      v: JWT_ACCESS_PAYLOAD_VERSION,
      sub: payload.sub,
      role: payload.role ?? 'USER',
    };
    const token = await new SignJWT({ v: body.v, role: body.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(body.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl}s`)
      .sign(this.accessSecret);

    return { token, expiresInSeconds: this.accessTtl };
  }

  public async signRefreshToken(payload: {
    sub: string;
    sid: string;
  }): Promise<{ token: string; expiresInSeconds: number }> {
    const token = await new SignJWT({
      v: JWT_ACCESS_PAYLOAD_VERSION,
      sid: payload.sid,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.refreshTtl}s`)
      .sign(this.refreshSecret);

    return { token, expiresInSeconds: this.refreshTtl };
  }

  public async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, this.accessSecret, {
      algorithms: ['HS256'],
    });
    if (payload.v !== JWT_ACCESS_PAYLOAD_VERSION) {
      throw new Error(`Unsupported access token version: ${String(payload.v)}`);
    }
    if (typeof payload.sub !== 'string') {
      throw new Error('Access token missing subject.');
    }
    return payload;
  }

  public async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jwtVerify<RefreshTokenPayload>(token, this.refreshSecret, {
      algorithms: ['HS256'],
    });
    if (payload.v !== JWT_ACCESS_PAYLOAD_VERSION) {
      throw new Error(`Unsupported refresh token version: ${String(payload.v)}`);
    }
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new Error('Refresh token malformed.');
    }
    return payload;
  }
}

export const AUTH_TOKEN_SERVICE = Symbol('AUTH_TOKEN_SERVICE');
