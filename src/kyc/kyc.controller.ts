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
