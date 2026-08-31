import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { BillingRepository } from './data/billing.repository';
import { UsageRepository } from './data/usage.repository';
import { StripeWebhookEventsRepository } from './data/stripe-webhook-events.repository';
import { BillingPolicy } from './policies/billing.policy';
import { UsageService } from './services/usage.service';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    BillingRepository,
    UsageRepository,
    StripeWebhookEventsRepository,
    BillingPolicy,
    UsageService,
  ],
  exports: [
    UsageService,
    BillingRepository,
    StripeWebhookEventsRepository,
    BillingPolicy,
  ],
})
export class BillingModule {}
