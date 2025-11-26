import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { SenderType, TicketStatus, UserRole } from '@prisma/client';

class CreateTicketDto {
  title: string;
  message: string;
}

class ReplyDto {
  message: string;
}

class AdminStatusDto {
  status: TicketStatus; // "OPEN" | "CLOSED"
}

@UseGuards(JwtAccessGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /** ユーザー: 自分のチケット一覧 */
  @Get()
  async myTickets(@Req() req: any) {
    const userId = Number(req.user.sub);

    const tickets = await this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return tickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      createdAt: t.createdAt,
      lastMessage: t.messages[0]?.message ?? null,
    }));
  }

  /** ユーザー: 新規チケット作成 */
  @Post()
  async create(@Req() req: any, @Body() body: CreateTicketDto) {
    const userId = Number(req.user.sub);
    if (!body.title || !body.message) {
      throw new BadRequestException('Title and message are required');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        title: body.title,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            sender: SenderType.USER,
            message: body.message,
          },
        },
      },
    });

    return ticket;
  }

  /** ユーザー・管理共通: メッセージ一覧 */
  @Get(':id/messages')
  async messages(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as any;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    if (user.role !== UserRole.ADMIN && ticket.userId !== Number(user.sub)) {
      throw new BadRequestException('Forbidden');
    }

    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  /** ユーザー: 自分のチケットに返信 */
  @Post(':id/reply')
  async reply(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReplyDto,
  ) {
    const userId = Number(req.user.sub);
    if (!body.message) {
      throw new BadRequestException('Message is required');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.userId !== userId) {
      throw new BadRequestException('Ticket not found');
    }

    const msg = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        sender: SenderType.USER,
        message: body.message,
      },
    });

    return msg;
  }

  /** 管理: 全チケット一覧 */
  @Get('admin/all')
  async adminAll(@Req() req: any) {
    this.assertAdmin(req);

    const tickets = await this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
      },
    });

    return tickets.map((t) => ({
      id: t.id,
      userId: t.userId,
      email: t.user.email,
      title: t.title,
      status: t.status,
      createdAt: t.createdAt,
    }));
  }

  /** 管理: チケットに返信 */
  @Post('admin/:id/reply')
  async adminReply(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReplyDto,
  ) {
    this.assertAdmin(req);
    if (!body.message) {
      throw new BadRequestException('Message is required');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new BadRequestException('Ticket not found');

    const msg = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        sender: SenderType.ADMIN,
        message: body.message,
      },
    });

    return msg;
  }

  /** 管理: ステータス変更 */
  @Post('admin/:id/status')
  async adminStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminStatusDto,
  ) {
    this.assertAdmin(req);

    if (!body.status) {
      throw new BadRequestException('Status is required');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new BadRequestException('Ticket not found');

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: body.status,
      },
    });

    return updated;
  }
}
