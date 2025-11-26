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
