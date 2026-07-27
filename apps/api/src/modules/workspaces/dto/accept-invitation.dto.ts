import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Public selector from the invitation token.' })
  @IsString()
  selector!: string;

  @ApiProperty({ description: 'Secret verifier from the invitation token.' })
  @IsString()
  verifier!: string;
}
