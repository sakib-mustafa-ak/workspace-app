import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { type SubscriptionView, UsageService } from '../services/usage.service';

@ApiTags('Billing')
@ApiBearerAuth()
@WorkspaceAccess('VIEWER', { param: 'workspaceId' })
@Controller({ path: 'workspaces/:workspaceId/subscription', version: '1' })
export class WorkspaceSubscriptionController {
  constructor(@Inject(UsageService) private readonly usage: UsageService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a workspace subscription plan and status' })
  public async getSubscription(
    @Param('workspaceId') workspaceId: string,
  ): Promise<SubscriptionView> {
    return this.usage.getSubscriptionView(workspaceId);
  }
}
