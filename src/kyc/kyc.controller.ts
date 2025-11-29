import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';

import * as fs from 'fs';
import * as path from 'path';

@UseGuards(JwtAccessGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly prisma: PrismaService) {}

  /** Status 名を返す */
  private statusLabel(level: number): string {
    switch (level) {
      case 0: return 'NONE';
      case 1: return 'SUBMITTED';
      case 2: return 'IN_REVIEW';
      case 3: return 'APPROVED_LEVEL1';
      case 4: return 'REJECTED';
      case 5: return 'COMPLETED';
      default: return 'UNKNOWN';
    }
  }

  /** 管理者チェック */
  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  // ----------------------------------------------------------
  // GET /kyc/status  （ユーザー側）
  // ----------------------------------------------------------
  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = Number(req.user.sub);

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

    return {
      exists: true,
      id: kyc.id,
      level: kyc.status,
      status: this.statusLabel(kyc.status),
      front: kyc.documentFront,
      back: kyc.documentBack,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  // ----------------------------------------------------------
  // POST /kyc/submit  （ユーザー側: 画像アップロード）
  // ----------------------------------------------------------
  @Post('submit')
  @UseInterceptors(FilesInterceptor('files', 2))
  async submit(
    @Req() req: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const userId = Number(req.user.sub);

    if (!files || files.length < 2) {
      throw new BadRequestException('表面と裏面の画像を両方アップロードしてください。');
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'kyc', String(userId));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const front = files[0];
    const back = files[1];

    const frontName = `front_${Date.now()}.jpg`;
    const backName = `back_${Date.now()}.jpg`;

    const frontPath = path.join(uploadDir, frontName);
    const backPath = path.join(uploadDir, backName);

    fs.renameSync(front.path, frontPath);
    fs.renameSync(back.path, backPath);

    const kyc = await this.prisma.kycRequest.create({
      data: {
        userId,
        status: 1, // SUBMITTED
        documentFront: `/uploads/kyc/${userId}/${frontName}`,
        documentBack: `/uploads/kyc/${userId}/${backName}`,
      },
    });

    return {
      message: 'KYCを提出しました（審査中）。',
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      front: kyc.documentFront,
      back: kyc.documentBack,
    };
  }

  // ----------------------------------------------------------
  // GET /kyc/admin/list  （管理者）
  // ----------------------------------------------------------
  @Get('admin/list')
  async adminList(@Req() req: any) {
    this.assertAdmin(req);

    const items = await this.prisma.kycRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    return items.map(k => ({
      id: k.id,
      userId: k.userId,
      name: k.user.name,
      email: k.user.email,
      level: k.status,
      statusText: this.statusLabel(k.status),
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
      frontUrl: k.documentFront,
      backUrl: k.documentBack,
    }));
  }

  // ----------------------------------------------------------
  // POST /kyc/admin/set-status  （管理者: 状態更新）
  // ----------------------------------------------------------
  @Post('admin/set-status')
  async adminSetStatus(
    @Req() req: any,
    @Body() body: { id: number; level: number },
  ) {
    this.assertAdmin(req);

    const id = Number(body.id);
    const level = Number(body.level);

    if (!id) throw new BadRequestException('Invalid KYC id');
    if (isNaN(level) || level < 0 || level > 5) {
      throw new BadRequestException('Invalid level (0〜5)');
    }

    const kyc = await this.prisma.kycRequest.findUnique({ where: { id } });
    if (!kyc) throw new BadRequestException('KYC record not found');

    const updated = await this.prisma.kycRequest.update({
      where: { id },
      data: {
        status: level,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      level: updated.status,
      statusText: this.statusLabel(updated.status),
      updatedAt: updated.updatedAt,
    };
  }
}
