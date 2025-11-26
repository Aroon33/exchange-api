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
