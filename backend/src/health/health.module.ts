import { Module } from '@nestjs/common';
import { AiClassificationModule } from '../ai-classification/ai-classification.module';
import { PrismaService } from '../prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [AiClassificationModule],
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class HealthModule {}
