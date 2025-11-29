import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,      // ← ★これがないと絶対にログインできない
      name: true,
      role: true,
      systemStatus: true,
      wallet: true,
      group: true,
    },
  });
}


  async createUser(params: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
  }) {
    const { email, password, name, role = UserRole.USER } = params;

    return this.prisma.$transaction(async (tx) => {
      // Prisma のトランザクションクライアントを any として扱って型エラーを避ける
      const client = tx as any;

      const user = await client.user.create({
        data: {
          email,
          password: password,
          name,
          role,
        },
      });

      await client.wallet.create({
        data: {
          userId: user.id,
          balanceTotal: 0,
          balanceAvailable: 0,
          balanceLocked: 0,
        },
      });

      return user;
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true, group: true },
    });
  }
}
