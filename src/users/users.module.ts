import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module'; // ← 必要

@Module({
  imports: [PrismaModule],  // ← これが足りなかった
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
