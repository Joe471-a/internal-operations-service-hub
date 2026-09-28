import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Handles GET /health
   * No guard - Render's health check and an operator have no session, and
   * nothing here is private.
   *  - ok or degraded -> 200 with the report. Degraded is still 200 on
   *    purpose: the hub works without the AI, so Render must not restart it.
   *  - error (database unreachable) -> 503 with the same report, so the
   *    caller still sees what is down rather than just that something is
   */
  @Get()
  async check() {
    const report = await this.health.check();
    if (report.status === 'error') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
