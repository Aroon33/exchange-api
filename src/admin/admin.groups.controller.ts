import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Admin only');
    }
  }

  /** 文字列を code 用に正規化（英数字のみ） */
  private normalizeCode(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** --------------------------
   * グループ一覧取得
   * -------------------------- */
  @Get()
  async list() {
    const groups = await this.prisma.group.findMany({
      orderBy: { id: 'asc' },
      include: {
        users: true,
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      inviteLink: `https://exchange-template.com/signup.html?ref=${g.code}`,
      userCount: g.users.length,
    }));
  }

  /** --------------------------
   * 新規作成
   * -------------------------- */
  @Post('create')
  async create(@Body() body: { name: string }) {
    if (!body.name) throw new BadRequestException('name is required');

    let code = this.normalizeCode(body.name);

    // 重複回避
    const exists = await this.prisma.group.findUnique({ where: { code } });
    if (exists) code = code + Date.now();

    const group = await this.prisma.group.create({
      data: { name: body.name, code },
    });

    return {
      message: 'Group created',
      group,
      inviteLink: `https://exchange-template.com/signup.html?ref=${code}`,
    };
  }

  /** --------------------------
   * 編集（name + code）
   * -------------------------- */
  @Patch(':id')
  async edit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; code?: string },
  ) {
    const data: any = {};

    if (body.name) data.name = body.name;

    if (body.code) {
      const newCode = this.normalizeCode(body.code);
      const exist = await this.prisma.group.findUnique({
        where: { code: newCode },
      });

      if (exist && exist.id !== id) {
        throw new BadRequestException('code already exists');
      }

      data.code = newCode;
    }

    const updated = await this.prisma.group.update({
      where: { id },
      data,
    });

    return {
      message: 'Group updated',
      group: updated,
    };
  }

  /** --------------------------
   * 削除（所属ユーザーの groupId を null へ）
   * -------------------------- */
  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    // 所属ユーザーを groupId = null に更新
    await this.prisma.user.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await this.prisma.group.delete({ where: { id } });

    return { message: 'Group deleted' };
  }
}
