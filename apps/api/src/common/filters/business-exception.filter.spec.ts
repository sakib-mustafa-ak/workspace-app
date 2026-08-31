import { ArgumentsHost } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import { BusinessExceptionFilter } from './business-exception.filter';

class TestException extends BusinessException {
  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(code, message, status, details);
  }
}

type MockResponse = {
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<MockResponse, [unknown]>;
};

describe('BusinessExceptionFilter', () => {
  let filter: BusinessExceptionFilter;
  let response: MockResponse;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new BusinessExceptionFilter();
    response = {
      status: jest.fn<MockResponse, [number]>().mockReturnThis(),
      json: jest.fn<MockResponse, [unknown]>().mockReturnThis(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/api/v1/test', method: 'GET' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('includes error.details when the exception carries them', () => {
    filter.catch(
      new TestException('BILLING.LIMIT_REACHED', 'Plan limit reached.', 422, {
        feature: 'boards',
        current: 3,
        limit: 3,
        plan: 'FREE',
      }),
      host,
    );
    const body = response.json.mock.calls[0][0] as Record<string, unknown>;
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('BILLING.LIMIT_REACHED');
    expect(error.details).toMatchObject({ feature: 'boards', current: 3 });
    expect(body.success).toBe(false);
  });

  it('omits error.details when the exception has none', () => {
    filter.catch(new TestException('TEST.CODE', 'plain', 409), host);
    const body = response.json.mock.calls[0][0] as {
      error?: Record<string, unknown>;
    };
    expect(body.error).toEqual({ code: 'TEST.CODE' });
  });
});
