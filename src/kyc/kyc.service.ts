import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ユーザーの最新KYCステータスを取得
   */
  async getStatus(userId: number) {
    const latest = await this.prisma.kycRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return {
        exists: false,
        status: 0,
        level: 0,
        label: '未提出',
      };
    }

    return {
      exists: true,
      id: latest.id,
      userId: latest.userId,
      status: latest.status,
      level: latest.status,
      label: this.statusLabel(latest.status),
      documentFront: latest.documentFront,
      documentBack: latest.documentBack,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  }

  /**
   * KYC提出処理
   * front/back 画像パスをDBに保存
   * status = 1（提出済み）
   */
  async submit(userId: number, files: { front: string; back: string }) {
    if (!files.front || !files.back) {
      throw new BadRequestException('front/back 画像が両方必要です。');
    }

    const kyc = await this.prisma.kycRequest.create({
      data: {
        userId,
        status: 1, // 1 = 提出済み
        documentFront: files.front,
        documentBack: files.back,
      },
    });

    return {
      message: 'KYCを提出しました（審査中）。',
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      label: this.statusLabel(kyc.status),
      front: kyc.documentFront,
      back: kyc.documentBack,
    };
  }

  /**
   * 管理者：全KYC一覧
   */
  async listAll() {
    return this.prisma.kycRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
      },
    });
  }

  /**
   * 管理者：KYCステータス変更
   * status = 0〜5
   */
  async setStatus(id: number, status: number, reason?: string) {
    const kyc = await this.prisma.kycRequest.findUnique({ where: { id } });
    if (!kyc) {
      throw new NotFoundException('KYCリクエストが見つかりません');
    }

    const updated = await this.prisma.kycRequest.update({
      where: { id },
      data: {
        status,
        // documentBack に否認理由を暫定保存（必要ならカラム追加可）
        documentBack: reason ?? kyc.documentBack,
      },
    });

    return {
      message: 'KYCステータスを更新しました',
      id: updated.id,
      status: updated.status,
      label: this.statusLabel(updated.status),
      reason: reason ?? null,
    };
  }

  /**
   * KYCステータスのラベル
   */
  private statusLabel(status: number): string {
    switch (status) {
      case 0: return '未提出';
      case 1: return '提出済み';
      case 2: return '審査中';
      case 3: return '承認ステップ1';
      case 4: return '否認';
      case 5: return 'KYC完了';
      default: return 'UNKNOWN';
    }
  }
}
