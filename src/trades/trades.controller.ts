import { Controller, Get, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('trades')
export class TradesController {
  constructor(private prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /** ユーザーの取引履歴（マイページ/history用） */
  @Get('history')
  async history(@Req() req: any) {
    const userId = req.user.sub;

    const trades = await this.prisma.trade.findMany({
      where: { userId },
      orderBy: { closedAt: 'desc' },
    });

    return trades;
  }

  /** 管理者用：全ユーザーの取引履歴一覧（admin/trades.html 用） */
  @Get('admin/all')
  async adminAll(@Req() req: any) {
    this.assertAdmin(req);

    const trades = await this.prisma.trade.findMany({
      orderBy: { closedAt: 'desc' },
      include: {
        user: true,
      },
    });

    return trades.map((t) => ({
      id: t.id,
      userId: t.userId,
      email: t.user.email,
      symbol: t.symbol,
      side: t.side,
      size: t.size,
      entryPrice: t.entryPrice,
      closePrice: t.closePrice,
      profit: t.profit,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      groupId: t.groupId,
    }));
  }
}
