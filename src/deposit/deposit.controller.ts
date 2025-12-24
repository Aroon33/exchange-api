import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransferStatus,
  TransferType,
  UserRole,
} from '@prisma/client';
import { DepositService } from './deposit.service';

/**
 * 入金申請 DTO（JPY / CRYPTO 共通）
 */
class DepositRequestDto {
  amount: string;        // 円金額
  method?: 'JPY' | 'CRYPTO';
  currency?: 'JPY' | 'BTC' | 'ETH';
  cryptoAmount?: string;
}

/**
 * 入金承認 DTO（ADMIN）
 */
class ApproveDepositDto {
  id: number;
}

@UseGuards(JwtAccessGuard)
@Controller('deposit')
export class DepositController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depositService: DepositService,
  ) {}

  /* ===============================
     共通：管理者チェック
  =============================== */
  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  /* ===============================
     ユーザー：入金申請
  =============================== */
  @Post('request')
  async requestDeposit(
    @Req() req: any,
    @Body() body: DepositRequestDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const userId = Number(user.sub);

    const amountNum = Number(body.amount);
    if (!amountNum || amountNum <= 0) {
      throw new BadRequestException('Invalid deposit amount');
    }

    const method = body.method ?? 'JPY';
    if (!['JPY', 'CRYPTO'].includes(method)) {
      throw new BadRequestException('Invalid method');
    }

    const currency =
      method === 'JPY'
        ? 'JPY'
        : body.currency && ['BTC', 'ETH'].includes(body.currency)
        ? body.currency
        : null;

    if (method === 'CRYPTO' && !currency) {
      throw new BadRequestException('Invalid crypto currency');
    }

    const cryptoAmount =
      method === 'CRYPTO' && body.cryptoAmount
        ? Number(body.cryptoAmount)
        : null;

    if (method === 'CRYPTO' && (!cryptoAmount || cryptoAmount <= 0)) {
      throw new BadRequestException('Invalid cryptoAmount');
    }

    const transfer = await this.prisma.transfer.create({
      data: {
        userId,
        type: TransferType.DEPOSIT,
        method,
        currency,
        amount: amountNum.toString(),
        cryptoAmount: cryptoAmount ? cryptoAmount.toString() : null,
        status: TransferStatus.PENDING,
      },
    });

    return {
      message: '入金申請を受け付けました',
      transfer,
    };
  }

  /* ===============================
     ユーザー：入金先情報取得
     （サンクスページ用）
  =============================== */
  @Get('config')
  async getDepositConfig(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const bankAccount = await this.prisma.depositBankAccount.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!bankAccount) {
      throw new BadRequestException(
        '使用中の入金先口座が設定されていません',
      );
    }

    return {
      bank: {
        name: bankAccount.bankName,
        branch: bankAccount.branchName,
        type: bankAccount.accountType ?? '普通',
        number: bankAccount.accountNumber,
        holder: bankAccount.accountHolder,
      },
      crypto: {
        BTC: 'bc1qbtcxxxxxxxxxxxxxxxxxxxxxx',
        ETH: '0xethxxxxxxxxxxxxxxxxxxxxxxxxx',
      },
      note: '入金確認後、残高に反映されます。',
    };
  }

  /* ===============================
     ADMIN：入金一覧（すべて）
  =============================== */
  @Get('all')
  async adminAll(@Req() req: any) {
    this.assertAdmin(req);

    return this.prisma.transfer.findMany({
      where: { type: TransferType.DEPOSIT },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  /* ===============================
     ADMIN：PENDING 入金一覧
  =============================== */
  @Get('pending')
  async listPending(@Req() req: any) {
    this.assertAdmin(req);

    return this.prisma.transfer.findMany({
      where: {
        type: TransferType.DEPOSIT,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  /* ===============================
     ADMIN：入金承認（★完全版★）
     - ステータス更新
     - ウォレット反映
     - チャット自動送信
  =============================== */
  @Post('approve')
async approve(
  @Req() req: any,
  @Body() body: ApproveDepositDto,
) {
  this.assertAdmin(req);

  const id = Number(body.id);
  if (!id || isNaN(id)) {
    throw new BadRequestException('Invalid deposit id');
  }

  return this.depositService.approveDeposit(id);
}
}
