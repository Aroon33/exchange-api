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
