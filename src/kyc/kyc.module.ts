import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads/kyc',
    }),
  ],
  providers: [KycService],
  controllers: [KycController],
})
export class KycModule {}
