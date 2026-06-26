import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: "ok",
      service: "workspace-api",
      version: "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}