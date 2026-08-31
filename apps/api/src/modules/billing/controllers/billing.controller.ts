import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';
import { CheckoutDto } from '../dto/checkout.dto';
import { PortalDto } from '../dto/portal.dto';
import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a Stripe Checkout session to upgrade a workspace',
  })
  public async checkout(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: CheckoutDto,
  ): Promise<{ url: string }> {
    return this.billing.checkout(
      body.workspaceId,
      user.id,
      user.email,
      body.plan,
    );
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open the Stripe billing portal for a workspace' })
  public async portal(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: PortalDto,
  ): Promise<{ url: string }> {
    return this.billing.portal(body.workspaceId, user.id);
  }

  @Public()
  @Throttle({ default: { limit: 1000, ttl: 60_000 } })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  public async webhook(@Req() req: Request): Promise<{ received: true }> {
    const signature =
      typeof req.headers['stripe-signature'] === 'string'
        ? req.headers['stripe-signature']
        : undefined;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody || !signature) {
      throw new BillingException(
        BillingErrorCode.WEBHOOK_INVALID,
        'Missing webhook body or stripe-signature header.',
        400,
      );
    }
    return this.billing.handleWebhook(rawBody, signature);
  }
}
