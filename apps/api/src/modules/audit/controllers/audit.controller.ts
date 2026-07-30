import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuditService } from '../services/audit.service';
import { ActivityQueryDto } from '../dto/activity-query.dto';
import { ActivityResponseDto, AuditEventDto } from '../dto/audit-response.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller({ path: 'workspaces/:id/activity', version: '1' })
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated workspace activity (audit log)' })
  @ApiOkResponse({ type: ActivityResponseDto })
  public async getActivity(
    @Param('id') id: string,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityResponseDto> {
    const result = await this.audit.getWorkspaceActivity(id, query);
    return {
      data: result.data.map(toAuditEventDto),
      nextCursor: result.nextCursor,
    };
  }
}

function toAuditEventDto(e: {
  id: string;
  createdAt: Date;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
}): AuditEventDto {
  return {
    id: e.id,
    workspaceId: e.workspaceId,
    userId: e.userId,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  };
}
