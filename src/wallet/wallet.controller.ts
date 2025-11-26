import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAccessGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req: Request) {
    const user = (req as any).user;
    return this.walletService.getWalletWithHistory(Number(user.sub));
  }
}
