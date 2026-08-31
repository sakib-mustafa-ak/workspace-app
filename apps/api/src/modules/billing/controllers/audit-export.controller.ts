import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { AuditService } from '../../audit/services/audit.service';
import { BILLING_FEATURES } from '../billing.constants';
import { UsageService } from '../services/usage.service';
import {
  buildExportPayload,
  type ExportFormat,
  type ExportPayload,
} from '../utils/export-serializer';

@ApiTags('Billing')
@ApiBearerAuth()
@WorkspaceAccess('ADMIN', { param: 'workspaceId' })
@Controller({ path: 'workspaces/:workspaceId/audit', version: '1' })
export class AuditExportController {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export the full workspace audit log (Team feature)',
  })
  public async exportAudit(
    @Param('workspaceId') workspaceId: string,
    @Query('format') format: string = 'json',
  ): Promise<ExportPayload> {
    const effectiveFormat: ExportFormat = format === 'csv' ? 'csv' : 'json';
    await this.usage.requireFeature(
      workspaceId,
      BILLING_FEATURES.AUDIT_LOG_EXPORT,
    );
    const rows = await this.audit.exportWorkspace(workspaceId);
    return buildExportPayload(rows, effectiveFormat);
  }
}
