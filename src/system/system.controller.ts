import {
  Controller,
  Post,
  Req,
  UseGuards,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';

class CloseCompleteDto {
  userId: number;
}

@UseGuards(JwtAccessGuard)
@Controller('system')
export class SystemController {
  constructor(private prisma: PrismaService) {}

  /** ユーザー側：停止要求 */
  @Post('stop')
  async stop(@Req() req: any) {
    const userId = Number(req.user.sub);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { systemStatus: 'STOP_REQUESTED' },
    });

    return updated;
  }

  /** 管理側：強制停止要求 */
  @Post('admin/stop-request')
  async adminStop(@Req() req: any, @Body() body: CloseCompleteDto) {
    if (req.user.role !== UserRole.ADMIN)
      throw new BadRequestException('Admin only');

    const updated = await this.prisma.user.update({
      where: { id: body.userId },
      data: { systemStatus: 'STOP_REQUESTED' },
    });

    return updated;
  }

  /** バッチ側：一括決済完了通知 */
  @Post('close-complete')
  async closeComplete(@Req() req: any, @Body() body: CloseCompleteDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: body.userId },
      data: { systemStatus: 'STOPPED' },
    });

    // 本当は Position と Wallet の集計もここで行う
    // Phase C では簡略化し、STOPPEDフラグだけ更新

    return updated;
  }
}
