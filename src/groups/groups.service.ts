import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups() {
    return this.prisma.group.findMany({
      orderBy: { id: 'asc' },
      include: { users: true },
    });
  }

  async moveUsersToGroup(groupId: number, userIds: number[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: { groupId },
      });

      return tx.group.findUnique({
        where: { id: groupId },
        include: { users: true },
      });
    });
  }
}
