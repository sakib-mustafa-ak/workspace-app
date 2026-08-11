import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCanvasObjectDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    enum: [
      'RECTANGLE',
      'ELLIPSE',
      'TEXT',
      'STICKY_NOTE',
      'IMAGE',
      'ARROW',
      'LINE',
      'PATH',
      'FRAME',
      'CONNECTOR',
    ],
  })
  @IsEnum([
    'RECTANGLE',
    'ELLIPSE',
    'TEXT',
    'STICKY_NOTE',
    'IMAGE',
    'ARROW',
    'LINE',
    'PATH',
    'FRAME',
    'CONNECTOR',
  ])
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  y?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rotation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  zIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fill?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stroke?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  strokeWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  opacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
