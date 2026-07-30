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
import { ActivityResponseDto } from '../dto/audit-response.dto';

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
    return this.audit.getWorkspaceActivity(id, query);
  }
}
