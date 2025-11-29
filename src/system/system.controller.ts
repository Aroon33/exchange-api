import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { SystemStatus, UserRole } from '@prisma/client';

class CloseCompleteDto {
  userId: number;
}

@UseGuards(JwtAccessGuard)
@Controller('system')
export class SystemController {
  constructor(private prisma: PrismaService) {}

  /** ユーザー側: システム停止リクエスト */
  @Post('stop')
  async stop(@Req() req: any) {
    const userId = Number(req.user.sub);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { systemStatus: SystemStatus.STOP_REQUESTED },
    });

    return updated;
  }

  /** 管理側: 特定ユーザーの停止リクエスト（強制） */
  @Post('admin/stop-request')
  async adminStop(@Req() req: any, @Body() body: CloseCompleteDto) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }

    const updated = await this.prisma.user.update({
      where: { id: body.userId },
      data: { systemStatus: SystemStatus.STOP_REQUESTED },
    });

    return updated;
  }

  /** バッチ側: 一括決済完了報告 → STOPPED へ */
  @Post('close-complete')
  async closeComplete(@Req() req: any, @Body() body: CloseCompleteDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: body.userId },
      data: { systemStatus: SystemStatus.STOPPED },
    });

    // 本来はポジションやウォレット更新もここで実施
    return updated;
  }

  /** 管理側: システム再開（RUNNINGへ） */
  @Post('admin/start')
  async adminStart(@Req() req: any, @Body() body: CloseCompleteDto) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: body.userId },
      data: { systemStatus: SystemStatus.RUNNING },
    });

    return updated;
  }

  /** システム概要: groupId / systemStatus / balanceTotal / positions(仮) を返す */
  @Get('overview')
  async overview(@Req() req: any) {
    const userId = Number(req.user.sub);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    // ポジションは今は未実装なので空配列として返す（将来ここに実データを詰める）
    const positions: any[] = [];

    return {
      userId,
      groupId: user.groupId,
      systemStatus: user.systemStatus,
      balanceTotal: wallet?.balanceTotal ?? 0,
      positions,
    };
  }
}
