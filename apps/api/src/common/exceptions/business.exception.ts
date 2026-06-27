import { HttpException } from '@nestjs/common';

/**
 * Base class for predictable business errors.
 *
 * Business errors are part of normal application flow and should be
 * translated to clear, machine-readable HTTP responses with stable error
 * codes. Concrete exceptions live next to the domain that owns them.
 *
 * Why a base class?
 * - Centralizes the API contract (status + machine code).
 * - Forces every business error to declare both fields explicitly.
 * - Avoids leaking low-level implementation details into responses.
 */
export abstract class BusinessException extends HttpException {
  public readonly code: string;

  protected constructor(
    code: string,
    message: string,
    status: number,
  ) {
    super({ code, message }, status);
    this.code = code;
  }
}

/**
 * Thrown when a domain entity cannot be located.
 */
export class NotFoundException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}

/**
 * Thrown when input does not satisfy business rules that go beyond
 * shape validation (e.g. workspace archived, seat limit exceeded).
 */
export class UnprocessableEntityException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, 422);
  }
}

/**
 * Thrown when state already conflicts with the requested action.
 */
export class ConflictException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}
