import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Body for `POST /auth/request-password-reset`.
 *
 * The endpoint is "always 202" — even when the email does not match
 * any user — so account existence is never leaked (Part IX-API
 * Standards). No authentication is required (Part V-A "Password Reset").
 */
export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'Email address to send the reset link to.',
    example: 'ada@example.com',
  })
  @IsEmail()
  email!: string;
}
