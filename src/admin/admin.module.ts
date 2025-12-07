// src/admin/admin.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { AdminController } from './admin.controller';
import { AdminUsersController } from './users.admin.controller';
import { AdminTradesController } from './admin.trades.controller';
import { AdminGroupsController } from './admin.groups.controller';
import { AdminSystemController } from './admin.system.controller';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminTradesController,
    AdminGroupsController,
    AdminSystemController, // ← ★これがないと API が 404 になる
  ],
  providers: [PrismaService],
})
export class AdminModule {}
