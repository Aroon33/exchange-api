// src/system/system.controller.ts
import { 
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException
} from '@nestjs/common';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { SystemConfigService } from './system.config.service';
import { SystemTradeService } from './system.trade.service';

@UseGuards(JwtAccessGuard)
@Controller('system')
export class SystemController {
  constructor(
    private readonly configService: SystemConfigService,
    private readonly tradeService: SystemTradeService,
  ) {}

  /** -------------- settings.html 用：グループ別設定取得 -------------- */
  @Get('config/:groupId')
  getConfigByGroup(@Param('groupId') groupId: string) {
    return this.configService.getConfigByGroup(Number(groupId));
  }

  /** -------------- settings.html 用：グループ別設定保存 -------------- */
  @Post('config/:groupId')
  updateConfigByGroup(
    @Param('groupId') groupId: string,
    @Body() body: any,
  ) {
    return this.configService.updateConfigByGroup(Number(groupId), body);
  }

  /** -------------- 管理画面：手動トレードループ実行 -------------- */
  @Post('trade-loop')
  async runLoop() {
    await this.tradeService.autoTrade();
    return { message: 'loop executed' };
  }

  /** -------------- system-trade.html 用：システム概要取得 -------------- */
@Get('overview')
async getOverview(@Req() req: any) {
  const jwt = req.user;
  const userId = jwt.sub;
  const groupId = jwt.groupId;

  // DBからユーザー取得
  const dbUser = await this.tradeService.getUserById(userId);

  // 念のため null チェック（型エラー防止）
  const systemStatus = dbUser?.systemStatus ?? 'UNKNOWN';

  // wallet を取得
  const wallet = await this.tradeService.getWalletForUser(userId);

  // グループ代表口座の open positions
  const positions = await this.tradeService.getOpenPositionsByGroup(groupId);

  return {
    groupId,
    systemStatus,          // ← null の場合でも安全
    balanceTotal: wallet?.balanceTotal ?? 0,
    positions,
  };
}
// CLOSE GROUP (全銘柄)
@Post('close-group/:groupId')
async closeGroupAll(@Param('groupId') groupId: string) {
  await this.tradeService.closePositionsForGroup(Number(groupId));
  return { message: 'Group positions closed' };
}

// CLOSE GROUP (シンボル単位)
@Post('close-group/:groupId/:symbol')
async closeGroupSymbol(
  @Param('groupId') groupId: string,
  @Param('symbol')
  symbol: string
) {
  await this.tradeService.closePositionsForGroup(Number(groupId), symbol);
  return { message: `Group positions closed for ${symbol}` };
}

// CLOSE USER (全銘柄)
@Post('close-user/:userId')
async closeUserAll(@Param('userId') userId: string) {
  await this.tradeService.closePositionsForUser(Number(userId));
  return { message: 'User positions closed' };
}

// CLOSE USER (シンボル単位)
@Post('close-user/:userId/:symbol')
async closeUserSymbol(
  @Param('userId') userId: string,
  @Param('symbol') symbol: string
) {
  await this.tradeService.closePositionsForUser(Number(userId), symbol);
  return { message: `User positions closed for ${symbol}` };
}



  /** -------------- system-trade.html：STOP リクエスト -------------- */
  @Post('stop')
  async stopSystem(@Req() req: any) {
    const userId = req.user.sub; // ★user.id ではなく sub
    await this.configService.setUserSystemStatus(userId, 'STOP_REQUESTED');
    return { message: 'STOP requested' };
  }

  /** -------------- system-trade.html：Admin ONLY → START -------------- */
  @Post('admin/start')
  async adminStart(@Req() req: any) {
    const admin = req.user;

    if (admin.role !== 'ADMIN') {
      throw new BadRequestException('Admin only');
    }

    const userId = admin.sub;  // ★管理者自身のIDを RUNNING に戻す
    await this.configService.setUserSystemStatus(userId, 'RUNNING');

    return { message: 'System restarted' };
  }
}


