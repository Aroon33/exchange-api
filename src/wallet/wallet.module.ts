import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from '../prisma/prisma.module';   // ← これが必要！

@Module({
  imports: [PrismaModule],   // ← これが使えるようになる
  providers: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
