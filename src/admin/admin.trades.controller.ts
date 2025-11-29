import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('admin/trades')
export class AdminTradesController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /** 取引一覧（フィルター付き） */
  @Get()
  async listTrades(
    @Req() req: any,
    @Query('group') group?: string,
    @Query('userId') userId?: string,
    @Query('symbol') symbol?: string,
    @Query('side') side?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAdmin(req);

    return this.prisma.trade.findMany({
      where: {
        ...(group ? { groupId: Number(group) } : {}),
        ...(userId ? { userId: Number(userId) } : {}),
        ...(symbol ? { symbol } : {}),
        ...(side ? { side } : {}),
        ...(from ? { closedAt: { gte: new Date(from) } } : {}),
        ...(to ? { closedAt: { lte: new Date(to) } } : {}),
      },
      include: { user: true },
      orderBy: { closedAt: 'desc' },
    });
  }

  /** 編集 */
  @Post(':id/edit')
  async editTrade(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    this.assertAdmin(req);

    const updated = await this.prisma.trade.update({
      where: { id },
      data: {
        size: body.size,
        entryPrice: body.entryPrice,
        closePrice: body.closePrice,
        profit: body.profit,
        closedAt: new Date(body.closedAt),
      },
    });

    return { message: 'Updated', trade: updated };
  }

  /** 1件削除 */
  @Post(':id/delete')
  async deleteTrade(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertAdmin(req);

    await this.prisma.trade.delete({ where: { id } });

    return { message: 'Deleted', id };
  }

  /** 🔥 一括削除（今回の本命） */
  @Post('bulk-delete')
  async bulkDelete(
    @Req() req: any,
    @Body() body: { ids: number[] },
  ) {
    this.assertAdmin(req);

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids is required');
    }

    await this.prisma.trade.deleteMany({
      where: { id: { in: body.ids } },
    });

    return { message: 'Bulk deleted', count: body.ids.length };
  }
}
