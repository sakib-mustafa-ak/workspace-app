import { ApiProperty } from '@nestjs/swagger';
import type { TaskStatus, TaskPriority } from '@repo/database';

export class TaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  boardId!: string;

  @ApiProperty()
  columnId!: string;

  @ApiProperty({ example: 'Set up CI/CD pipeline' })
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  position!: number;

  @ApiProperty({ example: 'TODO' })
  status!: TaskStatus;

  @ApiProperty({ example: 'MEDIUM' })
  priority!: TaskPriority;

  @ApiProperty({ nullable: true })
  assigneeId!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ nullable: true })
  dueDate!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
