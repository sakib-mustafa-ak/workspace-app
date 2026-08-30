import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { AdminService } from '../services/admin.service';
import { AdminRepository } from '../data/admin.repository';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(AdminRepository) private readonly adminRepo: AdminRepository,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Look up users (email or id) — internal tool' })
  @ApiQuery({ name: 'query', required: true })
  public async getUsers(@Query('query') query: string) {
    return this.adminRepo.lookupUsers((query ?? '').trim(), 20);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Look up a single user' })
  public async getUserById(@Param('id') id: string) {
    return this.adminRepo.findUserById(id);
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Look up workspaces (name or slug)' })
  @ApiQuery({ name: 'query', required: true })
  public async getWorkspaces(@Query('query') query: string) {
    return this.adminRepo.lookupWorkspaces((query ?? '').trim(), 20);
  }

  @Get('workspaces/:id')
  @ApiOperation({ summary: 'Look up a single workspace' })
  public async getWorkspaceById(@Param('id') id: string) {
    return this.adminRepo.findWorkspaceById(id);
  }

  @Get('users/:id/subscription')
  @ApiOperation({ summary: 'Get a user subscription (stubbed until Phase 3)' })
  public getSubscription() {
    return AdminService.STUB_SUBSCRIPTION;
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Read back the platform admin audit log (filterable)',
  })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  public async getAudit(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.listAudit({ actorId, action, from, to });
  }

  @Post('users/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in as another user (audit-logged)' })
  public async impersonate(
    @CurrentUser() actor: CurrentUserModel,
    @Param('id') id: string,
  ) {
    return this.admin.impersonate(actor.id, id);
  }
}
