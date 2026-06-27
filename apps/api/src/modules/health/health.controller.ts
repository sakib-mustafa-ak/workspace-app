import {
  Controller,
  Get,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../auth/decorators/public.decorator";
import { HealthService } from "./health.service";

/**
 * Liveness probe.
 *
 * Always public — protected-by-default would prevent cluster / load
 * balancer root probes from reaching this endpoint. Liveness does
 * NOT depend on the database (see HealthService.getHealth → uptime
 * only); readiness is a future concern.
 */
@ApiTags('Health')
@Controller({
  path: "health",
  version: "1",
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 + uptime metadata if the process is alive.',
  })
  getHealth() {
    return this.healthService.getHealth();
  }
}
