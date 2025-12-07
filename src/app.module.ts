import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';   // ★追加

import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { DepositModule } from './deposit/deposit.module';
import { SystemModule } from './system/system.module';
import { TradesModule } from './trades/trades.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { KycModule } from './kyc/kyc.module';
import { TicketsModule } from './tickets/tickets.module';
import { GroupsModule } from './groups/groups.module';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserExtraModule } from './user-extra/user-extra.module';



@Module({
  imports: [
    // ⭐ ← ここに追加    
PrismaModule,    
MulterModule.register({
      dest: './uploads/kyc',   // 保存先
    }),

    AuthModule,
    WalletModule,
    DepositModule,
    WithdrawModule,
    KycModule,
    TicketsModule,
    GroupsModule,
    SystemModule,
    TradesModule,
    AdminModule,
    UserExtraModule,
  ],
})
export class AppModule {}
