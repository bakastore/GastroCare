import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Local-dev CORS only, for the CORE-02 Web UI (Vite dev server / preview).
  // Not a production CORS policy — origin is a single configurable value.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: false,
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
