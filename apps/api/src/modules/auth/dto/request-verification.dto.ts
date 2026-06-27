import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

/**
 * Optional payload for `POST /auth/request-verification`.
 *
 * Behaviour:
 *  - If `email` is supplied, the API uses that.
 *  - If `email` is omitted, the API falls back to the JWT subject
 *    (Bearer-authenticated) so the route can be both public and
 *    "request on behalf of self" without forcing a different endpoint.
 *
 * Either way the response is always 202 "request accepted" — see
 * blueprint rule "We never expose whether an account already exists".
 */
export class RequestVerificationDto {
  @ApiProperty({
    required: false,
    description:
      'Email to verify. When omitted, the API uses the authenticated subject.',
    example: 'ada@example.com',
  })
  @IsOptional()
  @IsEmail()
  email!: string;
}
