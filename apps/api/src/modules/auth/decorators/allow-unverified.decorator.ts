import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'auth:allow-unverified';
/** Still requires authentication; permits only account-recovery/profile routes. */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
