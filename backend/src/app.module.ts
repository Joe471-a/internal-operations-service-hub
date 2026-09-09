import { Module } from '@nestjs/common';
import { RequestsModule } from './requests/requests.module';

/**
 * The root of the application.
 * Wires in the request lifecycle feature.
 */

@Module({
  imports: [RequestsModule],
})
export class AppModule {}
