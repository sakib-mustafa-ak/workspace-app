import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { BillingController } from './controllers/billing.controller';
import { WorkspaceSubscriptionController } from './controllers/workspace-subscription.controller';
import { BillingRepository } from './data/billing.repository';
import { StripeWebhookEventsRepository } from './data/stripe-webhook-events.repository';
import { UsageRepository } from './data/usage.repository';
import { BillingPolicy } from './policies/billing.policy';
import { BillingService } from './services/billing.service';
import { StripeService } from './services/stripe.service';
import { UsageService } from './services/usage.service';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [BillingController, WorkspaceSubscriptionController],
  providers: [
    BillingRepository,
    StripeWebhookEventsRepository,
    UsageRepository,
    BillingPolicy,
    UsageService,
    StripeService,
    BillingService,
  ],
  exports: [
    UsageService,
    BillingRepository,
    StripeWebhookEventsRepository,
    BillingPolicy,
    StripeService,
    BillingService,
  ],
})
export class BillingModule {}
