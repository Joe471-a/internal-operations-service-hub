import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonNestLogger } from './logging/json-nest-logger';
import { log } from './logging/log';
import { requestLogger } from './logging/request-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonNestLogger() });

  // One log line per request - see logging/request-logger.ts.
  app.use(requestLogger);

  // Let the hub frontend (a different address) talk to this backend - and
  // only it. CORS_ORIGIN is the frontend's address (comma-separate several);
  // without it, the local Vite dev server. Browsers enforce this; it is an
  // extra layer on top of login and authorization, not a replacement for them.
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  // Which exact version just started - Render sets RENDER_GIT_COMMIT.
  log('info', 'startup', { release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local', port });
}

void bootstrap();
