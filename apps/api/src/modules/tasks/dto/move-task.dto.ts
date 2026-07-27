import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({ description: 'Target column ID' })
  @IsString()
  columnId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position?: number;
}
