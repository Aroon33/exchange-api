import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType, UserRole } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly prisma: PrismaService) {}

  /** 出金申請（ユーザー） */
  @Post('request')
  async request(
    @Req() req: any,
    @Body() body: { amount: string }
  ) {
    const userId = Number(req.user.sub);
    const amount = Number(body.amount);

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    if (Number(wallet.balanceAvailable) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.transfer.create({
        data: {
          userId,
          type: TransferType.WITHDRAW,
          amount: amount,
          status: TransferStatus.PENDING,
        },
      });

      await tx.wallet.update({
        where: { userId },
        data: {
          balanceAvailable: { decrement: amount },
          balanceLocked: { increment: amount },
        },
      });

      return result;
    });
  }

  /** Admin: 出金承認 */
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

    const tr = await this.prisma.transfer.findUnique({ where: { id } });
    if (!tr || tr.type !== TransferType.WITHDRAW) {
      throw new BadRequestException('Not a withdraw record');
    }

    if (tr.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Already processed');
    }

    return this.prisma.$transaction(async (tx) => {
      const res = await tx.transfer.update({
        where: { id },
        data: { status: TransferStatus.COMPLETED },
      });

      await tx.wallet.update({
        where: { userId: tr.userId },
        data: {
          balanceLocked: { decrement: tr.amount },
          balanceTotal: { decrement: tr.amount },
        },
      });

      return res;
    });
  }

  /** Admin: 出金キャンセル */
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

    const tr = await this.prisma.transfer.findUnique({ where: { id } });
    if (!tr || tr.type !== TransferType.WITHDRAW) {
      throw new BadRequestException('Not a withdraw record');
    }

    if (tr.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Already processed');
    }

    return this.prisma.$transaction(async (tx) => {
      const res = await tx.transfer.update({
        where: { id },
        data: { status: TransferStatus.CANCELED },
      });

      await tx.wallet.update({
        where: { userId: tr.userId },
        data: {
          balanceLocked: { decrement: tr.amount },
          balanceAvailable: { increment: tr.amount },
        },
      });

      return res;
    });
  }

  /** Admin: 全出金履歴（テーブル表示用） */
  @Get('all')
  async adminAll(@Req() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    return this.prisma.transfer.findMany({
      where: { type: TransferType.WITHDRAW },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true, // ★ 名前を表示させるために必須
      },
    });
  }

  /** Admin: PENDINGのみ取得（旧API互換） */
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
      include: {
        user: true,
      },
    });
  }
}
