import type { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordResetService } from '../services/password-reset.service';

describe('signup verification dispatch', () => {
  it.each([false, true])(
    'keeps a created account recoverable when mail fails=%s',
    async (fail) => {
      const verification = {
        requestVerification: fail
          ? jest.fn().mockRejectedValue(new Error('mail unavailable'))
          : jest.fn().mockResolvedValue(undefined),
      };
      const auth = {
        register: jest.fn().mockResolvedValue({
          user: {
            id: 'user',
            displayName: 'Test',
            email: 'test@example.test',
            status: 'ACTIVE',
            emailVerifiedAt: null,
          },
          tokens: { accessToken: 'access', refreshToken: 'refresh' },
        }),
      };
      const controller = new AuthController(
        auth as unknown as AuthService,
        verification as unknown as EmailVerificationService,
        {} as PasswordResetService,
      );
      const result = await controller.register(
        {
          displayName: 'Test',
          email: 'test@example.test',
          password: 'Test-only-password1!',
        },
        { headers: {} } as Request,
      );
      expect(result.user.emailVerifiedAt).toBeNull();
      expect(verification.requestVerification).toHaveBeenCalledWith({
        userId: 'user',
        email: 'test@example.test',
      });
    },
  );
});
