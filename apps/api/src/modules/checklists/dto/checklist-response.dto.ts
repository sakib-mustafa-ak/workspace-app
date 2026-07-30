import { ApiProperty } from '@nestjs/swagger';

export class ChecklistItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() completed!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
