import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType, UserRole } from '@prisma/client';
import { WithdrawService } from './withdraw.service';

/**
 * 出金申請 DTO（JPY / CRYPTO 共通）
 */
type WithdrawRequestDto = {
  amount?: string;          // JPY換算額
  method?: 'JPY' | 'CRYPTO';
  currency?: 'BTC' | 'ETH';
  cryptoAmount?: string;    // CRYPTO時のみ
};

@UseGuards(JwtAccessGuard)
@Controller('withdraw')
export class WithdrawController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawService: WithdrawService,
  ) {}

  /* ===============================
     ユーザー：出金申請
     ※ 出金可否（KYC含む）は Service に委譲
  =============================== */
  @Post('request')
  async request(
    @Req() req: any,
    @Body() body: WithdrawRequestDto,
  ) {
    const userId = Number(req.user.sub);
    const method = body.method ?? 'JPY';

    if (!['JPY', 'CRYPTO'].includes(method)) {
      throw new BadRequestException('Invalid withdraw method');
    }

    /* ---------- JPY 出金 ---------- */
    if (method === 'JPY') {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        throw new BadRequestException('Invalid amount');
      }

      return this.withdrawService.requestWithdraw(userId, amount);
    }

    /* ---------- CRYPTO 出金 ---------- */
    const cryptoAmount = Number(body.cryptoAmount);
    const currency = body.currency;
    const amount = Number(body.amount);

    if (!currency || !['BTC', 'ETH'].includes(currency)) {
      throw new BadRequestException('Invalid crypto currency');
    }

    if (!cryptoAmount || cryptoAmount <= 0) {
      throw new BadRequestException('Invalid cryptoAmount');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid JPY amount');
    }

    // ※ 現仕様では JPY換算額でロック（Service側が最終判断）
    return this.withdrawService.requestWithdraw(userId, amount);
  }

  /* ===============================
     Admin：出金承認
  =============================== */
  @Post('approve')
async approve(
  @Req() req: any,
  @Body() body: { transferId: number },
) {
  if (req.user.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Admin only');
  }

  const id = Number(body.transferId);
  if (!id) throw new BadRequestException('Invalid ID');

  return this.withdrawService.approveWithdraw(id);
}


  /* ===============================
     Admin：出金キャンセル
     - 出金キャンセル
     - KYC status = 4
     - チャット送信
  =============================== */
  @Post('cancel')
  async cancel(
    @Req() req: any,
    @Body() body: { transferId: number },
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    const id = Number(body.transferId);
    if (!id) throw new BadRequestException('Invalid ID');

    return this.withdrawService.cancelWithdrawWithKycRollback(id);
  }

  /* ===============================
     Admin：全出金履歴
  =============================== */
  @Get('all')
  async adminAll(@Req() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    return this.prisma.transfer.findMany({
      where: { type: TransferType.WITHDRAW },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  /* ===============================
     Admin：PENDING 出金のみ
  =============================== */
  @Get('pending')
  async pending(@Req() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    return this.prisma.transfer.findMany({
      where: {
        type: TransferType.WITHDRAW,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }
}
