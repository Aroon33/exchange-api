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
import { TransferStatus, TransferType, UserRole } from '@prisma/client';

import { ForbiddenException } from '@nestjs/common';

// 入金申請 DTO（JPY / CRYPTO 共通）
class DepositRequestDto {
  amount: string;        // 円金額（必須）
  method?: string;       // 'JPY' | 'CRYPTO'
  currency?: string;     // 'JPY' | 'BTC' | 'ETH'
  cryptoAmount?: string; // 暗号通貨入金時の枚数
}

// 承認 DTO
class ApproveDepositDto {
  id?: number;
}

@UseGuards(JwtAccessGuard)
@Controller('deposit')
export class DepositController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    const user = req.user as any;
    if (!user || user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /**
   * ユーザー入金申請
   * 日本円 or 暗号通貨（BTC/ETH）の両方対応
   */
  @Post('request')
  async requestDeposit(@Req() req: any, @Body() body: DepositRequestDto) {
    const user = req.user as any;
    const userId = Number(user.sub);

    // amount（円）は必須
    const amountNum = Number(body.amount);
    if (!body.amount || isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Invalid deposit amount');
    }

    // method: 'JPY' | 'CRYPTO'
    const method = body.method || 'JPY';
    if (!['JPY', 'CRYPTO'].includes(method)) {
      throw new BadRequestException('Invalid method');
    }

    // currency
    const currency =
      method === 'JPY'
        ? 'JPY'
        : body.currency && ['BTC', 'ETH'].includes(body.currency)
        ? body.currency
        : null;

    if (method === 'CRYPTO' && !currency) {
      throw new BadRequestException('Invalid crypto currency');
    }

    // cryptoAmount（暗号通貨入金のとき）
    const cryptoAmount =
      method === 'CRYPTO' && body.cryptoAmount
        ? Number(body.cryptoAmount)
        : null;

    if (method === 'CRYPTO' && (!cryptoAmount || cryptoAmount <= 0)) {
      throw new BadRequestException('Invalid cryptoAmount');
    }

    // Transfer テーブルに保存
    const transfer = await this.prisma.transfer.create({
      data: {
        userId,
        type: TransferType.DEPOSIT,
        amount: amountNum.toString(),
        status: TransferStatus.PENDING,
        method,
        currency,
        cryptoAmount: cryptoAmount ? cryptoAmount.toString() : null,
      },
    });

    return {
      message: '入金申請を受け付けました',
      transfer,
    };
  }

  @Get('all')
    async adminAll(@Req() req: any) {
      if (req.user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Admin only');
      }
  
      return this.prisma.transfer.findMany({
        where: { type: TransferType.WITHDRAW },
        orderBy: { createdAt: 'desc' },
        include: {
          user: true, // ★ 名前を表示させるために必須
        },
      });
    }

  /**
   * Pending入金リスト（ADMIN専用）
   */
  @Get('pending')
async listPending(@Req() req: any) {
  this.assertAdmin(req);

  const items = await this.prisma.transfer.findMany({
    where: {
      type: TransferType.DEPOSIT,
      status: TransferStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: true, // ⭐ ユーザー情報を一緒に返す！
    }
  });

  return items;
}


  /**
   * 入金承認（ADMIN）
   * wallet に金額を反映
   */
  @Post('approve')
  async approve(@Req() req: any, @Body() body: ApproveDepositDto) {
    this.assertAdmin(req);

    let transfer;

    // 指定IDがある場合
    if (body.id) {
      const id = Number(body.id);
      if (!id || isNaN(id)) throw new BadRequestException('Invalid id');

      transfer = await this.prisma.transfer.findUnique({ where: { id } });
      if (!transfer) throw new BadRequestException('Transfer not found');
    } else {
      transfer = await this.prisma.transfer.findFirst({
        where: { type: TransferType.DEPOSIT, status: TransferStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });
      if (!transfer) throw new BadRequestException('No pending deposit found');
    }

    if (transfer.type !== TransferType.DEPOSIT)
      throw new BadRequestException('Transfer is not a deposit');
    if (transfer.status !== TransferStatus.PENDING)
      throw new BadRequestException('Transfer is not pending');

    const userId = transfer.userId;

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const amount = Number(transfer.amount);
    const available = Number(wallet.balanceAvailable);
    const locked = Number(wallet.balanceLocked);

    const newAvailable = available + amount;
    const newTotal = newAvailable + locked;

    const [updatedTransfer, updatedWallet] =
      await this.prisma.$transaction([
        this.prisma.transfer.update({
          where: { id: transfer.id },
          data: { status: TransferStatus.COMPLETED },
        }),
        this.prisma.wallet.update({
          where: { userId },
          data: {
            balanceAvailable: newAvailable.toString(),
            balanceLocked: locked.toString(),
            balanceTotal: newTotal.toString(),
          },
        }),
      ]);

    return {
      transfer: updatedTransfer,
      wallet: updatedWallet,
    };
  }
}
