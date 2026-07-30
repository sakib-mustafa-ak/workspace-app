import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  newOwnerId!: string;
}
