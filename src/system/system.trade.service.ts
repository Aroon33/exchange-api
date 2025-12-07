// src/system/system.trade.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemRateService } from './system.rate.service';

@Injectable()
export class SystemTradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: SystemRateService, // ★外部レート・スプレッド対応
  ) {}

  /** 自動トレード開始 */
  async autoTrade() {
    const settings = await this.prisma.systemTemplate.findMany({
      where: { name: 'autoTradeConfig' },
    });

    if (!settings.length) return;

    for (const st of settings) {
      const params = JSON.parse(st.params || '{}');
      const groupId = st.groupId;
      await this.runGroupLogic(groupId, params);
    }
  }

  /** グループ設定処理 */
  private async runGroupLogic(groupId: number, params: any) {
    const symbols = params.symbols || params;

    for (const symbol of Object.keys(symbols)) {
      const conf = symbols[symbol];

      if (!conf || conf.status === 'STOP') continue;

      if (conf.status === 'ACTIVE') {
        await this.openIfNotExists(groupId, symbol, conf);
      }

      if (conf.status === 'PENDING') {
        await this.processPending(groupId, symbol, conf);
      }
    }
  }

  /** ------------------------------
   * ACTIVE → 親＋子（PAM配分）で新規建て
   * ------------------------------ */
  private async openIfNotExists(groupId: number, symbol: string, conf: any) {
    const openExists = await this.prisma.trade.findFirst({
      where: {
        groupId,
        symbol,
        closePrice: null,
      },
    });

    if (openExists) return;

    const entryPrice = await this.fakePrice(symbol);

    /** 親口座 OPEN */
    await this.prisma.trade.create({
      data: {
        userId: 9999,
        symbol,
        side: conf.direction,
        size: conf.size,
        entryPrice,
        closePrice: null,
        profit: 0,
        openedAt: new Date(),
        closedAt: null,
        groupId,
      },
    });

    console.log(`[OPEN_PARENT] g${groupId} ${symbol} @ ${entryPrice}`);

    /** ★ 子口座へPAMロット配分コピー開始 ----------------------- */

    // groupId の全ユーザー
    const users = await this.prisma.user.findMany({
      where: { groupId },
      include: { wallet: true },
    });

    const children = users.filter((u) => u.id !== 9999);

    // 子口座の総残高
    const totalBalance = children.reduce(
      (sum, u) => sum + Number(u.wallet?.balanceTotal ?? 0),
      0,
    );

    if (totalBalance <= 0) {
      console.log(`[WARN] g${groupId} PAM配分：総残高ゼロのため子口座コピーをスキップ`);
      return;
    }

    for (const u of children) {
      const userBalance = Number(u.wallet?.balanceTotal ?? 0);

      // 証拠金比率
      let userLot = conf.size * (userBalance / totalBalance);

      // 端数切り捨て
      userLot = Math.floor(userLot / 0.01) * 0.01;

      // 最低ロット保証
      if (userLot < 0.01) userLot = 0.01;

      await this.prisma.trade.create({
        data: {
          userId: u.id,
          groupId,
          symbol,
          side: conf.direction,
          size: userLot,
          entryPrice,
          closePrice: null,
          profit: 0,
          openedAt: new Date(),
          closedAt: null,
        },
      });

      console.log(
        `[OPEN_CHILD] g${groupId} user=${u.id} ${symbol} lot=${userLot} @ ${entryPrice}`,
      );
    }

    /** ★ 子口座PAMコピーここまで ------------------------------- */
  }

  /** ------------------------------
   * PENDING → 決済処理（旧ロジック）
   * ------------------------------ */
  private async processPending(groupId: number, symbol: string, conf: any) {
    const opens = await this.prisma.trade.findMany({
      where: {
        groupId,
        symbol,
        closePrice: null,
      },
    });

    const price = await this.fakePrice(symbol);

    for (const t of opens) {
      const profit =
        conf.direction === 'BUY'
          ? (price - Number(t.entryPrice)) * Number(t.size)
          : (Number(t.entryPrice) - price) * Number(t.size);

      await this.prisma.trade.update({
        where: { id: t.id },
        data: {
          closePrice: price,
          profit,
          closedAt: new Date(),
        },
      });

      console.log(
        `[CLOSE_PENDING] g${groupId} ${symbol} profit=${profit.toFixed(2)}`,
      );
    }
  }

  /** --------------------------
   * Wallet・User補助関数
   * -------------------------- */
  async getWalletForUser(userId: number) {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }

  async getUserById(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /** ------------------------------
   * 親一斉決済 → 子全員決済
   * ------------------------------ */
  async closePositionsForGroup(groupId: number, symbol?: string) {
    const parentTrades = await this.prisma.trade.findMany({
      where: {
        userId: 9999,
        groupId,
        closePrice: null,
        ...(symbol ? { symbol } : {}),
      },
    });

    for (const p of parentTrades) {
      const closePrice = await this.rateService.getFinalClosePrice(
        p.symbol,
        p.side,
      );

      const parentProfit =
        p.side === 'BUY'
          ? (closePrice - Number(p.entryPrice)) * Number(p.size)
          : (Number(p.entryPrice) - closePrice) * Number(p.size);

      await this.prisma.trade.update({
        where: { id: p.id },
        data: {
          closePrice,
          profit: parentProfit,
          closedAt: new Date(),
        },
      });

      console.log(
        `[CLOSE_PARENT] g${groupId} ${p.symbol} profit=${parentProfit}`,
      );

      /** 子口座クローズ */
      const children = await this.prisma.trade.findMany({
        where: {
          groupId,
          userId: { not: 9999 },
          symbol: p.symbol,
          closePrice: null,
        },
      });

      for (const c of children) {
        const profit =
          c.side === 'BUY'
            ? (closePrice - Number(c.entryPrice)) * Number(c.size)
            : (Number(c.entryPrice) - closePrice) * Number(c.size);

        await this.prisma.trade.update({
          where: { id: c.id },
          data: {
            closePrice,
            profit,
            closedAt: new Date(),
          },
        });

        await this.prisma.wallet.update({
          where: { userId: c.userId },
          data: {
            balanceTotal: { increment: profit },
            balanceAvailable: { increment: profit },
          },
        });

        console.log(
          `[CLOSE_CHILD] g${groupId} user=${c.userId} ${c.symbol} profit=${profit}`,
        );
      }
    }
  }

  /** ------------------------------
   * 子口座個別決済
   * ------------------------------ */
  async closePositionsForUser(userId: number, symbol?: string) {
    const opens = await this.prisma.trade.findMany({
      where: {
        userId,
        closePrice: null,
        ...(symbol ? { symbol } : {}),
      },
    });

    for (const t of opens) {
      const closePrice = await this.rateService.getFinalClosePrice(
        t.symbol,
        t.side,
      );

      const profit =
        t.side === 'BUY'
          ? (closePrice - Number(t.entryPrice)) * Number(t.size)
          : (Number(t.entryPrice) - closePrice) * Number(t.size);

      await this.prisma.trade.update({
        where: { id: t.id },
        data: {
          closePrice,
          profit,
          closedAt: new Date(),
        },
      });

      await this.prisma.wallet.update({
        where: { userId },
        data: {
          balanceTotal: { increment: profit },
          balanceAvailable: { increment: profit },
        },
      });

      console.log(
        `[CLOSE_USER] user=${userId} ${t.symbol} profit=${profit}`,
      );
    }
  }

  /** --------------------------
   * 代表口座 OPENポジション取得
   * -------------------------- */
  async getOpenPositionsByGroup(groupId: number) {
    const trades = await this.prisma.trade.findMany({
      where: { groupId, closePrice: null },
      orderBy: { openedAt: 'desc' },
    });

    return trades.map((t) => {
      const currentPrice =
        Number(t.entryPrice) * (1 + (Math.random() - 0.5) * 0.002);

      const pnl =
        t.side === 'BUY'
          ? (currentPrice - Number(t.entryPrice)) * Number(t.size)
          : (Number(t.entryPrice) - currentPrice) * Number(t.size);

      return {
        symbol: t.symbol,
        size: t.size,
        entryPrice: t.entryPrice,
        currentPrice,
        unrealizedPnl: pnl,
        openedAt: t.openedAt,
      };
    });
  }

  /** 疑似価格（将来は外部APIに統合） */
  private async fakePrice(symbol: string): Promise<number> {
    const base = {
      BTCUSDT: 70000,
      ETHUSDT: 3200,
      SOLUSDT: 150,
      BNBUSDT: 600,
      XRPUSDT: 0.5,
      DOGEUSDT: 0.1,
      LTCUSDT: 90,
      ADAUSDT: 0.7,
      AVAXUSDT: 35,
      DOTUSDT: 8,
    }[symbol] || 100;

    const random = (Math.random() - 0.5) * 0.01 * base;
    return base + random;
  }
}
