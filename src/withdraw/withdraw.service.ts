import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class WithdrawService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 出金申請（ユーザー）
   *
   * ルール：
   * - KYC status = 5 のみ出金可能
   * - 残高不足は拒否
   * - 申請時に available → locked
   */
  async requestWithdraw(userId: number, amount: number) {
    /* ---------- KYCチェック ---------- */
    const kyc = await this.prisma.kycRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!kyc) {
      throw new BadRequestException(
        '出金にはKYC提出が必要です。'
      );
    }

    if (kyc.status !== 5) {
      throw new BadRequestException(
        'KYCが完了していません。出金可能なのはステータス5（完了）のみです。'
      );
    }

    /* ---------- ウォレット ---------- */
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (Number(wallet.balanceAvailable) < amount) {
      throw new BadRequestException('Insufficient available balance');
    }

    /* ---------- 出金申請 ---------- */
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          userId,
          type: TransferType.WITHDRAW,
          amount: amount.toString(),
          status: TransferStatus.PENDING,
        },
      });

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
      where: {
        type: TransferType.WITHDRAW,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 出金承認（Admin）
   */
  async approveWithdraw(transferId: number) {
  const transfer = await this.prisma.transfer.findUnique({
    where: { id: transferId },
  });

  if (!transfer || transfer.type !== TransferType.WITHDRAW) {
    throw new NotFoundException('Withdraw request not found');
  }

  if (transfer.status !== TransferStatus.PENDING) {
    throw new BadRequestException('Withdraw is not pending');
  }

  return this.prisma.$transaction(async (tx) => {
    /* ---------- 出金完了 ---------- */
    const updatedTransfer = await tx.transfer.update({
      where: { id: transferId },
      data: { status: TransferStatus.COMPLETED },
    });

    await tx.wallet.update({
      where: { userId: transfer.userId },
      data: {
        balanceLocked: { decrement: transfer.amount },
        balanceTotal: { decrement: transfer.amount },
      },
    });

    /* ---------- チャット送信（出金承認） ---------- */
    let ticket = await tx.ticket.findFirst({
      where: {
        userId: transfer.userId,
        status: 'OPEN',
      },
    });

    if (!ticket) {
      ticket = await tx.ticket.create({
        data: {
          userId: transfer.userId,
          title: '出金に関するご連絡',
          status: 'OPEN',
        },
      });
    }

    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'ADMIN',
        message: `
出金申請が承認されました。

指定された出金先へ送金処理を進めております。
反映まで今しばらくお待ちください。
        `.trim(),
      },
    });

    return updatedTransfer;
  });
}


  /**
   * 管理側：出金キャンセル
   * - 出金キャンセル
   * - KYC status = 4（追加認証）
   * - チャット自動通知
   */
  async cancelWithdrawWithKycRollback(transferId: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.type !== TransferType.WITHDRAW) {
      throw new NotFoundException('Withdraw request not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Withdraw is not pending');
    }

    const kyc = await this.prisma.kycRequest.findFirst({
      where: { userId: transfer.userId },
      orderBy: { createdAt: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      /* ---------- 出金キャンセル ---------- */
      await tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELED },
      });

      await tx.wallet.update({
        where: { userId: transfer.userId },
        data: {
          balanceLocked: { decrement: transfer.amount },
          balanceAvailable: { increment: transfer.amount },
        },
      });

      /* ---------- KYC 差し戻し ---------- */
      if (kyc) {
        await tx.kycRequest.update({
          where: { id: kyc.id },
          data: { status: 4 },
        });
      }

      /* ---------- チャット通知 ---------- */
      let ticket = await tx.ticket.findFirst({
        where: {
          userId: transfer.userId,
          status: 'OPEN',
        },
      });

      if (!ticket) {
        ticket = await tx.ticket.create({
          data: {
            userId: transfer.userId,
            title: '出金に関するご連絡',
            status: 'OPEN',
          },
        });
      }

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: 'ADMIN',
          message: `
出金申請の内容に確認事項があり、
追加の本人確認が必要となりました。

お手数ですが、
KYC（本人確認）の再提出をお願いいたします。

確認完了後、再度出金申請が可能になります。
          `.trim(),
        },
      });

      return { success: true };
    });
  }
}
