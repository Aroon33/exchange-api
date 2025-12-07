// src/system/system.config.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  /** グループ別設定取得 */
  async getConfigByGroup(groupId: number) {
    const cfg = await this.prisma.systemTemplate.findFirst({
      where: {
        groupId: groupId,
        name: 'autoTradeConfig',
      },
    });

    if (!cfg) {
      // DB にまだ設定が無い → デフォルト設定を返す
      return this.defaultConfig();
    }

    return JSON.parse(cfg.params);
  }

  /** グループ別設定保存 */
  async updateConfigByGroup(groupId: number, newCfg: any) {
    const json = JSON.stringify(newCfg);

    // 既存か確認
    const exists = await this.prisma.systemTemplate.findFirst({
      where: {
        groupId: groupId,
        name: 'autoTradeConfig',
      },
    });

    if (!exists) {
      // 新規作成
      return this.prisma.systemTemplate.create({
        data: {
          groupId: groupId,
          name: 'autoTradeConfig',
          params: json,
        },
      });
    }

    // 更新
    return this.prisma.systemTemplate.update({
      where: { id: exists.id },
      data: { params: json },
    });
  }
/** user.systemStatus を更新する */
async setUserSystemStatus(
  userId: number,
  status: 'RUNNING' | 'STOP_REQUESTED' | 'STOPPED'
) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { systemStatus: status },
  });
}


  /** デフォルト設定（初期値） */
  defaultConfig() {
    return {
      BTCUSDT: { direction: 'BUY', size: 0.01, holdMinutes: 10, pips: 2, status: 'ACTIVE' },
      ETHUSDT: { direction: 'SELL', size: 0.2, holdMinutes: 15, pips: 1.5, status: 'PENDING' },
      SOLUSDT: { direction: 'BUY', size: 1, holdMinutes: 5, pips: 0.8, status: 'ACTIVE' },
      XRPUSDT: { direction: 'BUY', size: 500, holdMinutes: 8, pips: 0.5, status: 'ACTIVE' },
      BNBUSDT: { direction: 'SELL', size: 0.5, holdMinutes: 12, pips: 2, status: 'ACTIVE' },
      DOGEUSDT: { direction: 'BUY', size: 1000, holdMinutes: 6, pips: 0.3, status: 'PENDING' },
      LTCUSDT: { direction: 'SELL', size: 0.1, holdMinutes: 14, pips: 1.1, status: 'ACTIVE' },
      ADAUSDT: { direction: 'BUY', size: 800, holdMinutes: 9, pips: 0.2, status: 'ACTIVE' },
      AVAXUSDT:{ direction: 'BUY', size: 3, holdMinutes: 7, pips: 1.3, status: 'STOP' },
      DOTUSDT:{ direction: 'SELL', size: 5, holdMinutes: 6, pips: 0.7, status: 'ACTIVE' },
    };
  }
}

