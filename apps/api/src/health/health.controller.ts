import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service.js";

@Controller({
  path: "health",
  version: "1",
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}