import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAccessGuard)
@Controller('admin/deposit/crypto-addresses')
export class AdminDepositCryptoAddressesController {
  constructor(private prisma: PrismaService) {}

  private assertAdmin(req:any){
    if(!req.user || req.user.role !== UserRole.ADMIN){
      throw new BadRequestException('Admin only');
    }
  }

  /** 一覧 */
  @Get()
  async list(@Req() req:any){
    this.assertAdmin(req);
    return this.prisma.$queryRaw`
      SELECT * FROM deposit_crypto_addresses
      ORDER BY createdAt DESC
    `;
  }

  /** 1件取得（編集用） */
  @Get(':id')
  async getOne(
    @Req() req:any,
    @Param('id') id:string
  ){
    this.assertAdmin(req);

    const row:any = await this.prisma.$queryRaw`
      SELECT * FROM deposit_crypto_addresses WHERE id = ${Number(id)}
    `;
    if(!row.length) throw new BadRequestException('Not found');
    return row[0];
  }

  /** 新規作成 */
  @Post()
  async create(
    @Req() req:any,
    @Body() body:any
  ){
    this.assertAdmin(req);

    if(!body.currency || !body.address){
      throw new BadRequestException('currency & address required');
    }

    await this.prisma.$executeRaw`
      INSERT INTO deposit_crypto_addresses
      (currency,address,memoTag,userId,used)
      VALUES
      (${body.currency},${body.address},${body.memoTag},${body.userId},0)
    `;

    return { message:'created' };
  }

  @Get(':id/delete')
async delete(
  @Req() req:any,
  @Param('id') id:string
){
  this.assertAdmin(req);

  await this.prisma.$executeRaw`
    DELETE FROM deposit_crypto_addresses
    WHERE id = ${Number(id)}
  `;

  return { message: 'deleted' };
}


  /** 更新 */
  @Post(':id')
  async update(
    @Req() req:any,
    @Param('id') id:string,
    @Body() body:any
  ){
    this.assertAdmin(req);



    await this.prisma.$executeRaw`
      UPDATE deposit_crypto_addresses
      SET
        currency = ${body.currency},
        address = ${body.address},
        memoTag = ${body.memoTag},
        userId = ${body.userId}
      WHERE id = ${Number(id)}
    `;

    return { message:'updated' };
  }
}
