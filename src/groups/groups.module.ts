import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  imports: [PrismaModule],
  providers: [GroupsService],
  controllers: [GroupsController],
})
export class GroupsModule {}
