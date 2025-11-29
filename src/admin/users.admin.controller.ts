import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole, SystemStatus } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  // -------------------------
  // 全ユーザー一覧
  // -------------------------
  @Get()
  async listUsers(@Req() req: any) {
    this.assertAdmin(req);

    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      include: {
        wallet: true,
        UserProfile: true,
        kycRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      groupId: u.groupId,
      systemStatus: u.systemStatus,
      balanceTotal: u.wallet?.balanceTotal ?? 0,
      balanceAvailable: u.wallet?.balanceAvailable ?? 0,
      kycLevel: u.kycRequests[0]?.status ?? 0,
      createdAt: u.createdAt,
    }));
  }

  // -------------------------
  // 個別ユーザー詳細
  // -------------------------
  @Get(':id')
  async userDetail(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertAdmin(req);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        transfers: { orderBy: { createdAt: 'desc' } },
        kycRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
        UserProfile: true,
        group: true,
      },
    });

    if (!user) throw new BadRequestException('User not found');

    return user;
  }

  // -------------------------
  // systemStatus 更新（STOP / RUNNING）
  // -------------------------
  @Post(':id/system-status')
  async updateSystemStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: SystemStatus },
  ) {
    this.assertAdmin(req);

    if (!body.status) throw new BadRequestException('Status required');

    return this.prisma.user.update({
      where: { id },
      data: { systemStatus: body.status },
    });
  }

  // -------------------------
  // groupId の更新
  // -------------------------
  @Post(':id/group')
  async changeGroup(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { groupId: number },
  ) {
    this.assertAdmin(req);

    if (!body.groupId) throw new BadRequestException('groupId required');

    return this.prisma.user.update({
      where: { id },
      data: { groupId: body.groupId },
    });
  }
}
