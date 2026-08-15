import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({ description: 'Target column ID' })
  @IsUUID()
  columnId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  position?: number;
}
