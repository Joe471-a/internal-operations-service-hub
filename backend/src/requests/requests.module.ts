import { Module } from '@nestjs/common';
import { AiClassificationModule } from '../ai-classification/ai-classification.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { UsersModule } from '../users/users.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AiClassificationModule, UsersModule, AuthModule],
  controllers: [RequestsController],
  providers: [RequestsService, PrismaService],
})
export class RequestsModule {}
