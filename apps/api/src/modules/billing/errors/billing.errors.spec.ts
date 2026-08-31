import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  BillingErrorCode,
  BillingException,
  FeatureRequiredException,
  LimitReachedException,
} from './billing.errors';

describe('billing errors', () => {
  it('BillingException extends BusinessException and exposes details', () => {
    const ex = new BillingException(BillingErrorCode.NO_CUSTOMER, 'nope', 409, {
      x: 1,
    });
    expect(ex).toBeInstanceOf(BusinessException);
    expect(ex.code).toBe('BILLING.NO_CUSTOMER');
    expect(ex.details).toEqual({ x: 1 });
    expect(ex.getStatus()).toBe(409);
  });

  it('LimitReachedException is 422 with structured details', () => {
    const ex = new LimitReachedException({
      feature: 'members',
      current: 3,
      limit: 3,
      plan: 'FREE',
    });
    expect(ex.getStatus()).toBe(422);
    expect(ex.details).toMatchObject({
      feature: 'members',
      current: 3,
      limit: 3,
      plan: 'FREE',
    });
  });

  it('FeatureRequiredException is 422 with feature + plan', () => {
    const ex = new FeatureRequiredException({
      feature: 'AUDIT_LOG_EXPORT',
      plan: 'PRO',
    });
    expect(ex.getStatus()).toBe(422);
    expect(ex.code).toBe('BILLING.FEATURE_REQUIRED');
  });
});
