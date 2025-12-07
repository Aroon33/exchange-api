import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';
import { PrismaModule } from '../prisma/prisma.module';  // ← 必須

@Module({
  imports: [PrismaModule],  // ← これが足りない
  providers: [DepositService],
  controllers: [DepositController],
})
export class DepositModule {}
