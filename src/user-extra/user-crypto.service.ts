import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveCryptoDto } from './dto/save-crypto.dto';

@Injectable()
export class UserCryptoService {
  constructor(private readonly prisma: PrismaService) {}

  /** すべて取得 */
  async getList(userId: number) {
    return this.prisma.userCryptoAddress.findMany({
      where: { userId },
    });
  }

  /** 複数アドレス保存（UPSERT） */
  async saveList(userId: number, dto: SaveCryptoDto) {
    const results = [];

    for (const c of dto.addresses) {
      const saved = await this.prisma.userCryptoAddress.upsert({
        where: {
          userId_currency: {
            userId,
            currency: c.currency,
          },
        },
        update: {
          address: c.address,
          memoTag: c.memoTag ?? null,
        },
        create: {
          userId,
          currency: c.currency,
          address: c.address,
          memoTag: c.memoTag ?? null,
        },
      });

      results.push(saved);
    }

    return results;
  }
}
