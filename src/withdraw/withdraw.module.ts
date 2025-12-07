import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { PrismaModule } from '../prisma/prisma.module';   // ← 必須！

@Module({
  imports: [PrismaModule],   // ← ここが抜けている
  providers: [WithdrawService],
  controllers: [WithdrawController],
})
export class WithdrawModule {}
