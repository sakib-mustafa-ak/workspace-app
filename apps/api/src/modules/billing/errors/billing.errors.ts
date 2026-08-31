import { BusinessException } from '../../../common/exceptions/business.exception';

export const BillingErrorCode = {
  NOT_CONFIGURED: 'BILLING.NOT_CONFIGURED',
  LIMIT_REACHED: 'BILLING.LIMIT_REACHED',
  FEATURE_REQUIRED: 'BILLING.FEATURE_REQUIRED',
  NO_CUSTOMER: 'BILLING.NO_CUSTOMER',
  PLAN_NOT_FOUND: 'BILLING.PLAN_NOT_FOUND',
  WEBHOOK_INVALID: 'BILLING.WEBHOOK_INVALID',
  FORBIDDEN: 'BILLING.FORBIDDEN',
} as const;
export type BillingErrorCodeValue = (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

export class BillingException extends BusinessException {
  constructor(
    code: BillingErrorCodeValue,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(code, message, status, details);
  }
}

export class LimitReachedException extends BillingException {
  constructor(details: { feature: string; current: number; limit: number; plan: string }) {
    super(BillingErrorCode.LIMIT_REACHED, 'Plan limit reached.', 422, details);
  }
}

export class FeatureRequiredException extends BillingException {
  constructor(details: { feature: string; plan: string }) {
    super(BillingErrorCode.FEATURE_REQUIRED, 'This feature is not included in your plan.', 422, details);
  }
}
