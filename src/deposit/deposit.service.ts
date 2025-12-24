import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransferStatus,
  TransferType,
  SenderType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class DepositService {
  constructor(private readonly prisma: PrismaService) {}

  /* =====================================================
     共通：CRYPTO アドレス割当 + ステータス遷移 + チャット
     ※ 必ずトランザクション内で呼ぶ
  ===================================================== */
  private async assignCryptoAddressAndSendMessage(
    tx: Prisma.TransactionClient,
    transfer: any,
  ) {
    if (!transfer.currency) {
      throw new BadRequestException('Currency missing');
    }

    // 🔒 未使用アドレスをロック取得
    const rows = await tx.$queryRaw<any[]>`
      SELECT *
      FROM deposit_crypto_addresses
      WHERE currency = ${transfer.currency}
        AND used = 0
        AND userId IS NULL
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE
    `;

    if (!rows.length) {
      throw new BadRequestException(
        `未使用の ${transfer.currency} アドレスがありません`,
      );
    }

    const addr = rows[0];

    // ① アドレス割当
    await tx.depositCryptoAddress.update({
      where: { id: addr.id },
      data: {
        used: true,
        userId: transfer.userId,
      },
    });

    // ② ステータス更新
    await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: TransferStatus.CONFIRMING,
      },
    });

    // ③ チケット取得 or 作成
    let ticket = await tx.ticket.findFirst({
      where: { userId: transfer.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!ticket) {
      ticket = await tx.ticket.create({
        data: {
          userId: transfer.userId,
          title: '入金のご案内',
        },
      });
    }

    // ④ チャット送信
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: SenderType.ADMIN,
        message:
`【入金用アドレスのご案内】

通貨：${addr.currency}
アドレス：
${addr.address}
${addr.memoTag ? `MEMO / TAG：${addr.memoTag}` : ''}

※ このアドレスは今回の入金専用です。
※ 着金確認後、残高へ反映されます。`,
      },
    });
  }

  /* =====================================================
     管理者：CRYPTO 入金アドレス割当（単体実行用）
  ===================================================== */
  async assignCryptoAddressAndNotify(transferId: number) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        throw new BadRequestException('Transfer not found');
      }

      if (
        transfer.type !== TransferType.DEPOSIT ||
        transfer.method !== 'CRYPTO' ||
        transfer.status !== TransferStatus.PENDING
      ) {
        throw new BadRequestException('Invalid transfer state');
      }

      await this.assignCryptoAddressAndSendMessage(tx, transfer);

      return { success: true };
    });
  }

  /* =====================================================
     入金承認（ADMIN）
     - JPY    : 即 COMPLETED + 残高反映
     - CRYPTO : アドレス割当 + CONFIRMING + チャット
  ===================================================== */
  async approveDeposit(transferId: number) {
    return this.prisma.$transaction(async (tx) => {

      /* =====================
         ① 入金取得
      ===================== */
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        throw new BadRequestException('Transfer not found');
      }

      if (transfer.type !== TransferType.DEPOSIT) {
        throw new BadRequestException('Not a deposit');
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new BadRequestException('Invalid status');
      }

      /* =====================
         ② JPY 入金
      ===================== */
      if (transfer.method === 'JPY') {
        const wallet = await tx.wallet.findUnique({
          where: { userId: transfer.userId },
        });

        if (!wallet) {
          throw new BadRequestException('Wallet not found');
        }

        const amount = Number(transfer.amount);

        await tx.wallet.update({
          where: { userId: transfer.userId },
          data: {
            balanceAvailable: { increment: amount },
            balanceTotal: { increment: amount },
          },
        });

        await tx.transfer.update({
          where: { id: transfer.id },
          data: { status: TransferStatus.COMPLETED },
        });

        return { success: true, type: 'JPY' };
      }

      /* =====================
         ③ CRYPTO 入金
      ===================== */
      if (transfer.method === 'CRYPTO') {
        await this.assignCryptoAddressAndSendMessage(tx, transfer);

        return {
          success: true,
          type: 'CRYPTO',
          status: 'CONFIRMING',
        };
      }

      throw new BadRequestException('Unsupported deposit method');
    });
  }
}
