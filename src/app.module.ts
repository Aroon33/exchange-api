import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { DepositModule } from './deposit/deposit.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { KycModule } from './kyc/kyc.module';
import { TicketsModule } from './tickets/tickets.module';
import { GroupsModule } from './groups/groups.module';
import { SystemModule } from './system/system.module'; // ← ★追加するのはココ

@Module({
  imports: [
    AuthModule,
    WalletModule,
    DepositModule,
    WithdrawModule,
    KycModule,
    TicketsModule,
    GroupsModule,
    SystemModule, // ← ★ココに追加でOK
  ],
})
export class AppModule {}
