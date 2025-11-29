import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie を扱えるようにする
  app.use(cookieParser());

  // フロント（ exchange-template.com ）からの CORS を許可
  app.enableCors({
    origin: [
      'https://exchange-template.com',
      'https://www.exchange-template.com',
    ],
    credentials: true,
  });

  await app.listen(3000);
  console.log('API running on port 3000');
}

bootstrap();
