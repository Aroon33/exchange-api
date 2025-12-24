import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie を扱えるようにする
  app.use(cookieParser());

  // CORS は Nginx 側で処理するため、NestJS では設定しない

  await app.listen(3000);
  console.log('API running on port 3000');
}

bootstrap();
