import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Token from the verification email link.
 *
 * The link is `https://app/auth/verify?selector=…&verifier=…`. We accept
 * a single opaque token here and split on the canonical delimiter
 * `selector.verifier` inside the service so the client never has to
 * know about the storage shape — only the URL it receives.
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'Opaque token from the verification email link.',
  })
  @IsString()
  @MinLength(20)
  token!: string;
}
