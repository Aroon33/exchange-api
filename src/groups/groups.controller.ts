import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  async list(@Req() req: Request) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.groupsService.listGroups();
  }

  @Post('move-users')
  @UseGuards(JwtAccessGuard)
  async move(
    @Req() req: Request,
    @Body() body: { groupId: number; userIds: number[] },
  ) {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.groupsService.moveUsersToGroup(Number(body.groupId), body.userIds.map(Number));
  }
}
