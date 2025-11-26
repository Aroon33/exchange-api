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

class DepositRequestDto {
  amount: string;
  method?: string;
}

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

  @Post('request')
  async requestDeposit(@Req() req: any, @Body() body: DepositRequestDto) {
    const user = req.user as any;
    const userId = Number(user.sub);

    const amountNum = Number(body.amount);
    if (!body.amount || isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Invalid deposit amount');
    }

    const transfer = await this.prisma.transfer.create({
      data: {
        userId,
        type: TransferType.DEPOSIT,
        amount: body.amount,
        status: TransferStatus.PENDING,
      },
    });

    // ★ 必ず JSON を返す
    return {
      id: transfer.id,
      userId: transfer.userId,
      type: transfer.type,
      amount: transfer.amount,
      status: transfer.status,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }

  @Get('pending')
  async listPending(@Req() req: any) {
    this.assertAdmin(req);

    const items = await this.prisma.transfer.findMany({
      where: {
        type: TransferType.DEPOSIT,
        status: TransferStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items;
  }

  @Post('approve')
  async approve(@Req() req: any, @Body() body: ApproveDepositDto) {
    this.assertAdmin(req);

    let transfer;

    if (body.id) {
      const id = Number(body.id);
      if (!id || isNaN(id)) {
        throw new BadRequestException('Invalid id');
      }
      transfer = await this.prisma.transfer.findUnique({ where: { id } });
      if (!transfer) throw new BadRequestException('Transfer not found');
    } else {
      transfer = await this.prisma.transfer.findFirst({
        where: { type: TransferType.DEPOSIT, status: TransferStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });
      if (!transfer) throw new BadRequestException('No pending deposit found');
    }

    if (transfer.type !== TransferType.DEPOSIT) {
      throw new BadRequestException('Transfer is not a deposit');
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Transfer is not pending');
    }

    const userId = transfer.userId;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    const amount = Number(transfer.amount);
    const available = Number(wallet.balanceAvailable);
    const locked = Number(wallet.balanceLocked);

    const newAvailable = available + amount;
    const newLocked = locked;
    const newTotal = newAvailable + newLocked;

    const [updatedTransfer, updatedWallet] = await this.prisma.$transaction([
      this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.COMPLETED },
      }),
      this.prisma.wallet.update({
        where: { userId },
        data: {
          balanceAvailable: newAvailable.toString(),
          balanceLocked: newLocked.toString(),
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
	

