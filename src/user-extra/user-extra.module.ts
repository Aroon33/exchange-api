import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { UserBankController } from './user-bank.controller';
import { UserBankService } from './user-bank.service';

import { UserCryptoController } from './user-crypto.controller';
import { UserCryptoService } from './user-crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserBankController, UserCryptoController],
  providers: [UserBankService, UserCryptoService],
})
export class UserExtraModule {}
