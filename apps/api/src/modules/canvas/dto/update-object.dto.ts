import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCanvasObjectDto {
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
