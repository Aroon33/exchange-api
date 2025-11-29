import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class WithdrawService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 出金申請（ユーザー）
   * - KYCステータスが 5（完了）でない場合は拒否
   * - 残高不足なら拒否
   * - 申請と同時に available → locked に移動（ロック）
   */
  async requestWithdraw(userId: number, amount: number) {
    // ① KYCチェック
// ▼ KYC が必須：レコードが無い場合は絶対に出金不可
const kyc = await this.prisma.kycRequest.findFirst({
  where: { userId },
  orderBy: { createdAt: 'desc' },
});

// ★ KYCレコード無し → 拒否
if (!kyc) {
  throw new BadRequestException(
    '出金にはKYC提出が必要です。KYCを提出してください。'
  );
}

// ★ KYCステータスが5でなければ拒否（あなたの仕様）
if (kyc.status !== 5) {
  throw new BadRequestException(
    'KYCが完了していません。出金可能なのはステータス5（完了）のみです。'
  );
}


    // ② ウォレット取得
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (Number(wallet.balanceAvailable) < amount) {
      throw new BadRequestException('Insufficient available balance');
    }

    // ③ 出金申請 (Pending)
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          userId,
          type: TransferType.WITHDRAW,
          amount: amount.toString(),
          status: TransferStatus.PENDING,
        },
      });

      // ④ ロック処理
      await tx.wallet.update({
        where: { userId },
        data: {
          balanceAvailable: { decrement: amount },
          balanceLocked: { increment: amount },
        },
      });

      return transfer;
    });
  }

  /**
   * Pending出金一覧（Admin）
   */
  async listPendingWithdraws() {
    return this.prisma.transfer.findMany({
      where: { type: TransferType.WITHDRAW, status: TransferStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 出金承認（Admin）
   */
  async approveWithdraw(transferId: number, adminId: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.type !== TransferType.WITHDRAW)
      throw new NotFoundException('Withdraw request not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new BadRequestException('Withdraw is not pending');

    return this.prisma.$transaction(async (tx) => {
      // 完了へ
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.COMPLETED },
      });

      // ロック → 完全引き落とし
      await tx.wallet.update({
        where: { userId: transfer.userId },
        data: {
          balanceLocked: { decrement: transfer.amount },
          balanceTotal: { decrement: transfer.amount },
        },
      });

      return updatedTransfer;
    });
  }

  /**
   * 出金キャンセル（Admin）
   */
  async cancelWithdraw(transferId: number, adminId: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.type !== TransferType.WITHDRAW)
      throw new NotFoundException('Withdraw request not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new BadRequestException('Withdraw is not pending');

    return this.prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELED },
      });

      // ロック解除 → available に戻す
      await tx.wallet.update({
        where: { userId: transfer.userId },
        data: {
          balanceLocked: { decrement: transfer.amount },
          balanceAvailable: { increment: transfer.amount },
        },
      });

      return updatedTransfer;
    });
  }
}
