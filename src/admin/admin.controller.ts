import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { TransferType, TransferStatus, TicketStatus, UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAccessGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (!user || user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /**
   * GET /admin/dashboard
   * 例: /admin/dashboard?from=2024-01-01&to=2025-12-31
   */
  @Get('dashboard')
  async dashboard(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const user = req.user;
    this.assertAdmin(user);

    if (!from || !to) {
      throw new BadRequestException('from と to は必須です');
    }

    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');

    // ① 総ユーザー数
    const totalUsers = await this.prisma.user.count();

    // ② 総残高
    const balanceAgg = await this.prisma.wallet.aggregate({
      _sum: { balanceTotal: true },
    });
    const totalBalance = balanceAgg._sum.balanceTotal ?? 0;

    // ③ 期間内の新規ユーザー
    const newUsers = await this.prisma.user.count({
      where: { createdAt: { gte: fromDate, lte: toDate } },
    });

    // ④ 入金合計
    const depAgg = await this.prisma.transfer.aggregate({
      _sum: { amount: true },
      where: {
        type: TransferType.DEPOSIT,
        status: TransferStatus.COMPLETED,
        createdAt: { gte: fromDate, lte: toDate },
      },
    });

    const depositSum = depAgg._sum.amount ?? 0;

    // ⑤ 出金合計
    const witAgg = await this.prisma.transfer.aggregate({
      _sum: { amount: true },
      where: {
        type: TransferType.WITHDRAW,
        status: TransferStatus.COMPLETED,
        createdAt: { gte: fromDate, lte: toDate },
      },
    });

    const withdrawSum = witAgg._sum.amount ?? 0;

    // ⑥ 入金 pending
    const pendingDeposits = await this.prisma.transfer.count({
      where: { type: TransferType.DEPOSIT, status: TransferStatus.PENDING },
    });

    // ⑦ 出金 pending
    const pendingWithdraws = await this.prisma.transfer.count({
      where: { type: TransferType.WITHDRAW, status: TransferStatus.PENDING },
    });

    // ⑧ KYC pending (0~4)
    const pendingKyc = await this.prisma.kycRequest.count({
      where: { status: { in: [0, 1, 2, 3, 4] } },
    });

    // ⑨ 問い合わせ pending
    const openTickets = await this.prisma.ticket.count({
      where: { status: TicketStatus.OPEN },
    });

    return {
      totalUsers,
      totalBalance,
      newUsers,
      depositSum,
      withdrawSum,
      pendingDeposits,
      pendingWithdraws,
      pendingKyc,
      openTickets,
    };
  }
}
