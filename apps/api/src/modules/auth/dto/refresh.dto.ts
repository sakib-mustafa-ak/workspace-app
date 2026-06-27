import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Opaque refresh token received from /auth/login.',
  })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
