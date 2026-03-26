import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Preset-based prompt payloads can be large; increase parser limits.
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '5mb' });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      if (isLocalhostOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 5001;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
