#!/bin/bash
set -e

echo "📁 Creating API module directories..."

mkdir -p src/wallet
mkdir -p src/deposit
mkdir -p src/withdraw
mkdir -p src/kyc
mkdir -p src/tickets
mkdir -p src/groups

#############################################
# Wallet Module
#############################################
echo "📝 Creating Wallet Module..."

cat << 'EOF' > src/wallet/wallet.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletWithHistory(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transfers = await this.prisma.transfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { wallet, transfers };
  }
}
EOF

cat << 'EOF' > src/wallet/wallet.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAccessGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req: Request) {
    const user = (req as any).user;
    return this.walletService.getWalletWithHistory(Number(user.sub));
  }
}
EOF

cat << 'EOF' > src/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  providers: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
EOF

#############################################
# Deposit Module
#############################################
echo "📝 Creating Deposit Module..."

cat << 'EOF' > src/deposit/deposit.service.ts
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
EOF

cat << 'EOF' > src/deposit/deposit.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { DepositService } from './deposit.service';

@Controller('deposit')
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  @Post('request')
  @UseGuards(JwtAccessGuard)
  async requestDeposit(
    @Req() req: Request,
    @Body() body: { amount: string },
  ) {
    const user = (req as any).user;
    return this.depositService.requestDeposit(Number(user.sub), body.amount);
  }

  @Get('pending')
  @UseGuards(JwtAccessGuard)
  async listPending(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.depositService.listPendingDeposits();
  }

  @Post('approve')
  @UseGuards(JwtAccessGuard)
  async approve(
    @Req() req: Request,
    @Body() body: { transferId: number },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.depositService.approveDeposit(Number(body.transferId), Number(user.sub));
  }
}
EOF

cat << 'EOF' > src/deposit/deposit.module.ts
import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';

@Module({
  providers: [DepositService],
  controllers: [DepositController],
})
export class DepositModule {}
EOF

#############################################
# Withdraw Module
#############################################
echo "📝 Creating Withdraw Module..."

cat << 'EOF' > src/withdraw/withdraw.service.ts
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
EOF

cat << 'EOF' > src/withdraw/withdraw.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { WithdrawService } from './withdraw.service';

@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Post('request')
  @UseGuards(JwtAccessGuard)
  async request(
    @Req() req: Request,
    @Body() body: { amount: string },
  ) {
    const user = (req as any).user;
    return this.withdrawService.requestWithdraw(Number(user.sub), body.amount);
  }

  @Get('pending')
  @UseGuards(JwtAccessGuard)
  async listPending(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.withdrawService.listPendingWithdraws();
  }

  @Post('approve')
  @UseGuards(JwtAccessGuard)
  async approve(@Req() req: Request, @Body() body: { transferId: number }) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.withdrawService.approveWithdraw(Number(body.transferId), Number(user.sub));
  }

  @Post('cancel')
  @UseGuards(JwtAccessGuard)
  async cancel(@Req() req: Request, @Body() body: { transferId: number }) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.withdrawService.cancelWithdraw(Number(body.transferId), Number(user.sub));
  }
}
EOF

cat << 'EOF' > src/withdraw/withdraw.module.ts
import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';

@Module({
  providers: [WithdrawService],
  controllers: [WithdrawController],
})
export class WithdrawModule {}
EOF

#############################################
# KYC Module
#############################################
echo "📝 Creating KYC Module..."

cat << 'EOF' > src/kyc/kyc.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: number) {
    const latest = await this.prisma.kycRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest ?? { status: 0 };
  }

  async submit(userId: number, payload: { documentFront?: string; documentBack?: string }) {
    const kyc = await this.prisma.kycRequest.create({
      data: {
        userId,
        status: 0,
        documentFront: payload.documentFront ?? null,
        documentBack: payload.documentBack ?? null,
      },
    });
    return kyc;
  }

  async listAll() {
    return this.prisma.kycRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStatus(id: number, status: number) {
    const kyc = await this.prisma.kycRequest.findUnique({ where: { id } });
    if (!kyc) {
      throw new NotFoundException('KYC request not found');
    }
    return this.prisma.kycRequest.update({
      where: { id },
      data: { status },
    });
  }
}
EOF

cat << 'EOF' > src/kyc/kyc.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @UseGuards(JwtAccessGuard)
  async status(@Req() req: Request) {
    const user = (req as any).user;
    return this.kycService.getStatus(Number(user.sub));
  }

  @Post('submit')
  @UseGuards(JwtAccessGuard)
  async submit(
    @Req() req: Request,
    @Body() body: { documentFront?: string; documentBack?: string },
  ) {
    const user = (req as any).user;
    return this.kycService.submit(Number(user.sub), body);
  }

  @Get('admin/list')
  @UseGuards(JwtAccessGuard)
  async listAll(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.kycService.listAll();
  }

  @Post('admin/set-status')
  @UseGuards(JwtAccessGuard)
  async setStatus(
    @Req() req: Request,
    @Body() body: { id: number; status: number },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.kycService.setStatus(Number(body.id), Number(body.status));
  }
}
EOF

cat << 'EOF' > src/kyc/kyc.module.ts
import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  providers: [KycService],
  controllers: [KycController],
})
export class KycModule {}
EOF

#############################################
# Ticket Module
#############################################
echo "📝 Creating Ticket Module..."

cat << 'EOF' > src/tickets/tickets.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType, TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyTickets(userId: number) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTicket(userId: number, title: string, message: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          userId,
          title,
          status: TicketStatus.OPEN,
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: SenderType.USER,
          message,
        },
      });

      return ticket;
    });
  }

  async replyToTicketAsUser(userId: number, ticketId: number, message: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException('Not your ticket');

    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        sender: SenderType.USER,
        message,
      },
    });
  }

  async listAllTickets() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async replyAsAdmin(ticketId: number, message: string) {
    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        sender: SenderType.ADMIN,
        message,
      },
    });
  }

  async setStatus(ticketId: number, status: TicketStatus) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  async getTicketMessages(ticketId: number) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
EOF

cat << 'EOF' > src/tickets/tickets.controller.ts
import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { TicketsService } from './tickets.service';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  async listMy(@Req() req: Request) {
    const user = (req as any).user;
    return this.ticketsService.listMyTickets(Number(user.sub));
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  async create(
    @Req() req: Request,
    @Body() body: { title: string; message: string },
  ) {
    const user = (req as any).user;
    return this.ticketsService.createTicket(Number(user.sub), body.title, body.message);
  }

  @Post(':id/reply')
  @UseGuards(JwtAccessGuard)
  async reply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const user = (req as any).user;
    return this.ticketsService.replyToTicketAsUser(Number(user.sub), Number(id), body.message);
  }

  @Get(':id/messages')
  @UseGuards(JwtAccessGuard)
  async messages(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    // ユーザー側も管理者側も同じAPIから取得できるようにしておく
    return this.ticketsService.getTicketMessages(Number(id));
  }

  // ==== Admin APIs ====
  @Get('admin/all')
  @UseGuards(JwtAccessGuard)
  async listAll(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.ticketsService.listAllTickets();
  }

  @Post('admin/:id/reply')
  @UseGuards(JwtAccessGuard)
  async adminReply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.ticketsService.replyAsAdmin(Number(id), body.message);
  }

  @Post('admin/:id/status')
  @UseGuards(JwtAccessGuard)
  async adminStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status: TicketStatus },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.ticketsService.setStatus(Number(id), body.status);
  }
}
EOF

cat << 'EOF' > src/tickets/tickets.module.ts
import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

@Module({
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
EOF

#############################################
# Groups Module
#############################################
echo "📝 Creating Groups Module..."

cat << 'EOF' > src/groups/groups.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups() {
    return this.prisma.group.findMany({
      orderBy: { id: 'asc' },
      include: { users: true },
    });
  }

  async moveUsersToGroup(groupId: number, userIds: number[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: { groupId },
      });

      return tx.group.findUnique({
        where: { id: groupId },
        include: { users: true },
      });
    });
  }
}
EOF

cat << 'EOF' > src/groups/groups.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  async list(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.groupsService.listGroups();
  }

  @Post('move-users')
  @UseGuards(JwtAccessGuard)
  async move(
    @Req() req: Request,
    @Body() body: { groupId: number; userIds: number[] },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.groupsService.moveUsersToGroup(Number(body.groupId), body.userIds.map(Number));
  }
}
EOF

cat << 'EOF' > src/groups/groups.module.ts
import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  providers: [GroupsService],
  controllers: [GroupsController],
})
export class GroupsModule {}
EOF

#############################################
# Update AppModule
#############################################
echo "📝 Updating AppModule..."

cat << 'EOF' > src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { DepositModule } from './deposit/deposit.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { KycModule } from './kyc/kyc.module';
import { TicketsModule } from './tickets/tickets.module';
import { GroupsModule } from './groups/groups.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletModule,
    DepositModule,
    WithdrawModule,
    KycModule,
    TicketsModule,
    GroupsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
EOF

echo "🎉 API modules created successfully!"
