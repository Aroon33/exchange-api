import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class WithdrawService {
  constructor(private readonly prisma: PrismaService) {}

  async requestWithdraw(userId: number, amount: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const numeric = Number(amount);
    if (numeric <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (Number(wallet.balanceAvailable) < numeric) {
      throw new BadRequestException('Insufficient available balance');
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          userId,
          type: TransferType.WITHDRAW,
          amount,
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

  async listPendingWithdraws() {
    return this.prisma.transfer.findMany({
      where: {
        type: TransferType.WITHDRAW,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveWithdraw(transferId: number, adminId: number) {
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
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.COMPLETED,
        },
      });

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

  async cancelWithdraw(transferId: number, adminId: number) {
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
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CANCELED,
        },
      });

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
