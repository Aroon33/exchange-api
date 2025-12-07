import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserBankService } from './user-bank.service';
import { SaveBankDto } from './dto/save-bank.dto';

@Controller('user/bank-account')
@UseGuards(JwtAccessGuard)
export class UserBankController {
  constructor(private readonly service: UserBankService) {}

  @Get()
  async getBank(@Req() req: any) {
    return this.service.getBankAccount(req.user.sub);
  }

  @Post()
  async saveBank(@Req() req: any, @Body() dto: SaveBankDto) {
    return this.service.saveBankAccount(req.user.sub, dto);
  }
}
