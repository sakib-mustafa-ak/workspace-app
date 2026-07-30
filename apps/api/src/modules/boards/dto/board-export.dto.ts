import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ExportBoardInfo {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
}

class ExportColumnInfo {
  @ApiProperty() name!: string;
  @ApiProperty() position!: number;
}

class ExportTaskInfo {
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() priority!: string;
  @ApiProperty() columnName!: string;
}

export class BoardExportData {
  @ApiProperty()
  @ValidateNested()
  @Type(() => ExportBoardInfo)
  board!: ExportBoardInfo;

  @ApiProperty({ type: [ExportColumnInfo] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportColumnInfo)
  columns!: ExportColumnInfo[];

  @ApiProperty({ type: [ExportTaskInfo] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportTaskInfo)
  tasks!: ExportTaskInfo[];
}
