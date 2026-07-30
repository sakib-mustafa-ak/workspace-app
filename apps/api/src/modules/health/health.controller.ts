import { Controller, Get, Inject } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
