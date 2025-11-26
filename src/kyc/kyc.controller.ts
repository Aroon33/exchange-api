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
import { UserRole } from '@prisma/client';

class KycSubmitDto {
  level: number;           // 1〜5
  documentType?: string;   // 使うなら拡張用
}

class KycAdminSetStatusDto {
  id: number;              // KycRequest id
  status: string;          // "APPROVED" | "REJECTED" | "IN_REVIEW"
  level?: number;          // 任意
  addressStatus?: string;  // "OK" | "NG"
  idStatus?: string;       // "OK" | "NG"
  reason?: string;
}

@UseGuards(JwtAccessGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    const user = req.user as any;
    if (!user || user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /**
   * ユーザー側: 現在のKYCステータス取得
   * GET /kyc/status
   */
  @Get('status')
  async getStatus(@Req() req: any) {
    const user = req.user as any;
    const userId = Number(user.sub);

    const kyc = await this.prisma.kycRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!kyc) {
      return {
        exists: false,
        level: 0,
        status: 'NONE',
      };
    }

    // status(Int) をそのまま level として返す
    return {
      exists: true,
      id: kyc.id,
      userId: kyc.userId,
      level: kyc.status,
      status: this.statusLabel(kyc.status),
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  /**
   * ユーザー側: KYC申請
   * POST /kyc/submit
   */
  @Post('submit')
  async submit(@Req() req: any, @Body() body: KycSubmitDto) {
    const user = req.user as any;
    const userId = Number(user.sub);

    const level = Number(body.level ?? 1);
    if (isNaN(level) || level < 1 || level > 5) {
      throw new BadRequestException('Invalid KYC level');
    }

    const kyc = await this.prisma.kycRequest.create({
      data: {
        userId,
        status: level,      // 0〜5段階として使う
        documentFront: body.documentType ?? null,
      },
    });

    return {
      id: kyc.id,
      userId: kyc.userId,
      level: kyc.status,
      status: this.statusLabel(kyc.status),
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  /**
   * 管理側: KYC一覧
   * GET /kyc/admin/list
   */
  @Get('admin/list')
  async adminList(@Req() req: any) {
    this.assertAdmin(req);

    const items = await this.prisma.kycRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
      },
    });

    return items.map((k) => ({
      id: k.id,
      userId: k.userId,
      email: k.user.email,
      level: k.status,
      status: this.statusLabel(k.status),
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));
  }

  /**
   * 管理側: KYCステータス更新
   * POST /kyc/admin/set-status
   */
  /**
   * 管理側: KYCステータス更新
   * POST /kyc/admin/set-status
   * body.id があればそのID、
   * 無ければ「最新の KYC レコード」を更新
   */
  @Post('admin/set-status')
  async adminSetStatus(@Req() req: any, @Body() body: KycAdminSetStatusDto) {
    this.assertAdmin(req);

    let kyc;

    if (body.id) {
      const id = Number(body.id);
      if (!id || isNaN(id)) {
        throw new BadRequestException('Invalid id');
      }
      kyc = await this.prisma.kycRequest.findUnique({ where: { id } });
      if (!kyc) {
        throw new BadRequestException('KycRequest not found');
      }
    } else {
      // ★ id 指定が無い場合は「最新の申請」を拾う
      kyc = await this.prisma.kycRequest.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (!kyc) {
        throw new BadRequestException('No KYC request found');
      }
    }

    const newLevel =
      typeof body.level === 'number' && !isNaN(body.level)
        ? body.level
        : kyc.status;

    const updated = await this.prisma.kycRequest.update({
      where: { id: kyc.id },
      data: {
        status: newLevel,
        documentBack: body.reason ?? kyc.documentBack,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      level: updated.status,
      status: this.statusLabel(updated.status),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  private statusLabel(status: number): string {
    switch (status) {
      case 0:
        return 'PENDING';
      case 1:
        return 'LEVEL1';
      case 2:
        return 'LEVEL2';
      case 3:
        return 'LEVEL3';
      case 4:
        return 'LEVEL4';
      case 5:
        return 'LEVEL5';
      default:
        return 'UNKNOWN';
    }
  }
}
