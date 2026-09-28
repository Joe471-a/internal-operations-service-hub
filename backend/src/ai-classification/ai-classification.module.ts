import { Module } from '@nestjs/common';
import { AiClassificationService } from './ai-classification.service';
import { GroqClassifierClient } from './groq-classifier.client';

@Module({
  providers: [GroqClassifierClient, AiClassificationService],
  // The client is exported too, so the health check can ask it whether Groq
  // is reachable - through the same boundary, never a second Groq caller.
  exports: [AiClassificationService, GroqClassifierClient],
})
export class AiClassificationModule {}
