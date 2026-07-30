import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const TEMPLATES = ['SPRINT', 'PROJECT', 'PERSONAL'] as const;
export type BoardTemplate = (typeof TEMPLATES)[number];

export class CreateBoardFromTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: TEMPLATES })
  @IsIn(TEMPLATES)
  template!: BoardTemplate;
}

const TEMPLATE_COLUMNS: Record<BoardTemplate, string[]> = {
  SPRINT: ['To Do', 'In Progress', 'In Review', 'Done'],
  PROJECT: ['Backlog', 'To Do', 'In Progress', 'Done'],
  PERSONAL: ['To Do', 'Doing', 'Done'],
};

export function getTemplateColumns(template: BoardTemplate): string[] {
  return TEMPLATE_COLUMNS[template];
}
