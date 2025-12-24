import {
  Controller,
  Post,
  Body,
  ForbiddenException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async adminLogin(
    @Body() body: { email: string; password: string },
  ) {
    const { email, password } = body;

    // ① ユーザー取得
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new ForbiddenException('Invalid credentials');
    }

    // ② パスワード検証（bcrypt 直接使用）
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new ForbiddenException('Invalid credentials');
    }

    // ③ ADMIN 以外は拒否
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }

    // ④ 既存 AuthService の login をそのまま使用
    return this.authService.login(user);
  }
}
