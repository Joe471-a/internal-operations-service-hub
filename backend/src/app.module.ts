import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RequestsModule } from './requests/requests.module';
import { UsersModule } from './users/users.module';

/**
 * The root of the application.
 * Wires in login/session, the user directory, and the request lifecycle.
 */

@Module({
  imports: [AuthModule, UsersModule, RequestsModule],
})
export class AppModule {}
