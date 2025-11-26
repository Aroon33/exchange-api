import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ★ ここを追加 ★
  app.enableCors({
    origin: [
      'https://exchange-template.com',
      'https://www.exchange-template.com',
    ],
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
