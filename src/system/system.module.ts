// src/system/system.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemController } from './system.controller';
import { SystemConfigService } from './system.config.service';
import { SystemTradeService } from './system.trade.service';
import { SystemRateService } from './system.rate.service';

@Module({
  controllers: [SystemController],
  providers: [
    PrismaService,
    SystemConfigService,
    SystemTradeService,
    SystemRateService, // ★ 追加
  ],
})
export class SystemModule {}
