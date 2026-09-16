import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Let the hub frontend (a different address) talk to this backend.
  app.enableCors();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Operations Hub backend running on http://localhost:${port}`);
}

void bootstrap();
