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
