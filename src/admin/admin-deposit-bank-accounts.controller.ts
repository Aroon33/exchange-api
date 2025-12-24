import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

@UseGuards(JwtAccessGuard)
@Controller('admin/deposit/bank-accounts')
export class AdminDepositBankAccountsController {
  constructor(private readonly prisma: PrismaService) {}

  /* ===============================
     管理者チェック
  =============================== */
  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  /* ===============================
     一覧取得（銀行管理画面）
  =============================== */
  @Get()
  async list(@Req() req: any) {
    this.assertAdmin(req);

    return this.prisma.depositBankAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /* ===============================
     単体取得（編集画面）
  =============================== */
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);

    const account = await this.prisma.depositBankAccount.findUnique({
      where: { id: Number(id) },
    });

    if (!account) {
      throw new BadRequestException('Bank account not found');
    }

    return account;
  }

  /* ===============================
     新規作成（最小構成）
  =============================== */
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);

    const {
      bankName,
      branchName,
      accountType,
      accountNumber,
      accountHolder,
    } = body;

    if (!bankName || !branchName || !accountNumber || !accountHolder) {
      throw new BadRequestException('Invalid params');
    }

    // 既存 ACTIVE を UNUSED に戻す（1件ルール）
    await this.prisma.depositBankAccount.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'UNUSED' },
    });

    // 新規口座を ACTIVE で作成
    return this.prisma.depositBankAccount.create({
      data: {
        bankName,
        branchName,
        accountType: accountType || '普通',
        accountNumber,
        accountHolder,
        status: 'ACTIVE',
      },
    });
  }

  /* ===============================
     更新
  =============================== */
  @Post(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);

    const {
      bankName,
      branchName,
      accountType,
      accountNumber,
      accountHolder,
    } = body;

    if (!bankName || !branchName || !accountNumber || !accountHolder) {
      throw new BadRequestException('Invalid params');
    }

    return this.prisma.depositBankAccount.update({
      where: { id: Number(id) },
      data: {
        bankName,
        branchName,
        accountType: accountType || '普通',
        accountNumber,
        accountHolder,
      },
    });
  }

  /* ===============================
     使用開始（ACTIVE）
  =============================== */
  @Get(':id/activate')
  async activate(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);

    await this.prisma.depositBankAccount.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'UNUSED' },
    });

    return this.prisma.depositBankAccount.update({
      where: { id: Number(id) },
      data: { status: 'ACTIVE' },
    });
  }

  /* ===============================
     解約（CLOSED）
  =============================== */
  @Get(':id/close')
  async close(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);

    return this.prisma.depositBankAccount.update({
      where: { id: Number(id) },
      data: { status: 'CLOSED' },
    });
  }

  /* ===============================
     未使用に戻す
  =============================== */
  @Get(':id/restore')
  async restore(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);

    return this.prisma.depositBankAccount.update({
      where: { id: Number(id) },
      data: { status: 'UNUSED' },
    });
  }

  /* ===============================
     削除
  =============================== */
  @Get(':id/delete')
  async remove(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);

    return this.prisma.depositBankAccount.delete({
      where: { id: Number(id) },
    });
  }
}
