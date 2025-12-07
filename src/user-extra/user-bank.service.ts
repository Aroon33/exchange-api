import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveBankDto } from './dto/save-bank.dto';

@Injectable()
export class UserBankService {
  constructor(private prisma: PrismaService) {}

  async getBankAccount(userId: number) {
    return this.prisma.userBankAccount.findUnique({ where: { userId } });
  }

  async saveBankAccount(userId: number, dto: SaveBankDto) {
    return this.prisma.userBankAccount.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto, updatedAt: new Date() },
    });
  }
}
