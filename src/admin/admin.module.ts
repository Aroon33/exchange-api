import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUsersController } from './users.admin.controller';
import { AdminTradesController } from './admin.trades.controller';
import { AdminGroupsController } from './admin.groups.controller';




@Module({
  controllers: [
    AdminController,
    AdminUsersController, 
    AdminTradesController,
    AdminGroupsController,
  ],
  providers: [PrismaService],
})
export class AdminModule {}

