// src/admin/admin.system.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAccessGuard)
@Controller('admin/system')
export class AdminSystemController {
  constructor(private readonly prisma: PrismaService) {}

  /** ▼ 親＋子の保有ポジション（system-positions 用） */
  @Get('positions/:groupId')
  async getPositions(@Param('groupId') groupId: string) {
    const gId = Number(groupId);

    // 親口座（9999）
    const parentTrades = await this.prisma.trade.findMany({
      where: { groupId: gId, userId: 9999, closePrice: null },
    });

    const parent = parentTrades.map((t) => {
      const current =
        Number(t.entryPrice) * (1 + (Math.random() - 0.5) * 0.002);
      const pnl =
        t.side === 'BUY'
          ? (current - Number(t.entryPrice)) * Number(t.size)
          : (Number(t.entryPrice) - current) * Number(t.size);

      return {
        symbol: t.symbol,
        size: t.size,
        entryPrice: t.entryPrice,
        currentPrice: current,
        unrealizedPnl: pnl,
        openedAt: t.openedAt,
      };
    });

    // 子口座
    const childTrades = await this.prisma.trade.findMany({
      where: { groupId: gId, userId: { not: 9999 }, closePrice: null },
      include: { user: true },
    });

    const children = childTrades.map((t) => {
      const current =
        Number(t.entryPrice) * (1 + (Math.random() - 0.5) * 0.002);
      const pnl =
        t.side === 'BUY'
          ? (current - Number(t.entryPrice)) * Number(t.size)
          : (Number(t.entryPrice) - current) * Number(t.size);

      return {
        userId: t.userId,
        userName: t.user?.name ?? '(unknown)',
        symbol: t.symbol,
        size: t.size,
        entryPrice: t.entryPrice,
        currentPrice: current,
        unrealizedPnl: pnl,
        openedAt: t.openedAt,
      };
    });

    return { parent, children };
  }

  /** ▼ 親＋子の取引履歴（system-history 用） */
  @Get('history/:groupId')
  async getHistory(@Param('groupId') groupId: string) {
    const gId = Number(groupId);

    // 親履歴（MAM）
    const parent = await this.prisma.trade.findMany({
      where: { groupId: gId, userId: 9999 },
      orderBy: { id: 'desc' },
    });

    // 子履歴（PAM）
    const children = await this.prisma.trade.findMany({
      where: { groupId: gId, userId: { not: 9999 } },
      include: { user: true },
      orderBy: { id: 'desc' },
    });

    return { parent, children };
  }
}
