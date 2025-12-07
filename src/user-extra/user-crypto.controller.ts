import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserCryptoService } from './user-crypto.service';
import { SaveCryptoDto } from './dto/save-crypto.dto';

@Controller('user/crypto')
@UseGuards(JwtAccessGuard)
export class UserCryptoController {
  constructor(private readonly service: UserCryptoService) {}

  @Get()
  async getList(@Req() req: any) {
    return this.service.getList(req.user.sub);
  }

  @Post()
  async save(@Req() req: any, @Body() dto: SaveCryptoDto) {
    return this.service.saveList(req.user.sub, dto);
  }
}
