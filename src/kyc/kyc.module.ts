import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [PrismaModule, 
    MulterModule.register({
      dest: './uploads/kyc',
    }),
  ],
  providers: [KycService],
  controllers: [KycController],
})
export class KycModule {}
