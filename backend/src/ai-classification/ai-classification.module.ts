import { Module } from '@nestjs/common';
import { AiClassificationService } from './ai-classification.service';
import { GroqClassifierClient } from './groq-classifier.client';

@Module({
  providers: [GroqClassifierClient, AiClassificationService],
  exports: [AiClassificationService],
})
export class AiClassificationModule {}
