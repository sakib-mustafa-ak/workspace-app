import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AdminAuditRepository } from './data/admin-audit.repository';
import { AdminRepository } from './data/admin.repository';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, AdminAuditRepository],
})
export class AdminModule {}
