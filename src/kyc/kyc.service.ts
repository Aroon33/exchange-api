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
