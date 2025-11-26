import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class DepositService {
  constructor(private readonly prisma: PrismaService) {}

  async requestDeposit(userId: number, amount: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transfer = await this.prisma.transfer.create({
      data: {
        userId,
        type: TransferType.DEPOSIT,
        amount,
        status: TransferStatus.PENDING,
      },
    });

    return transfer;
  }

  async listPendingDeposits() {
    return this.prisma.transfer.findMany({
      where: {
        type: TransferType.DEPOSIT,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveDeposit(transferId: number, adminId: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.type !== TransferType.DEPOSIT) {
      throw new NotFoundException('Deposit request not found');
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Deposit is not pending');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.COMPLETED,
          // adminId などを後で追加したければここに
        },
      });

      await tx.wallet.update({
        where: { userId: transfer.userId },
        data: {
          balanceTotal: {
            increment: transfer.amount,
          },
          balanceAvailable: {
            increment: transfer.amount,
          },
        },
      });

      return updatedTransfer;
    });
  }
}
