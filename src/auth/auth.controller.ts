import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import type { Response, Request } from 'express';


@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh, user } = await this.auth.login(dto);

    res.cookie('access_token', access, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 86400 * 1000,
    });

    return { user };
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  me(@Req() req: Request) {
    return { user: (req as any).user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }
}
