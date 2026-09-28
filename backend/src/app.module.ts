import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RequestsModule } from './requests/requests.module';
import { UsersModule } from './users/users.module';

/**
 * The root of the application.
 * Wires in login/session, the user directory, the request lifecycle, and
 * the health check the hosting platform and operators use.
 */

@Module({
  imports: [AuthModule, UsersModule, RequestsModule, HealthModule],
})
export class AppModule {}
