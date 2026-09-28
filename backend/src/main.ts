import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Let the hub frontend (a different address) talk to this backend - and
  // only it. CORS_ORIGIN is the frontend's address (comma-separate several);
  // without it, the local Vite dev server. Browsers enforce this; it is an
  // extra layer on top of login and authorization, not a replacement for them.
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Operations Hub backend running on http://localhost:${port}`);
}

void bootstrap();
