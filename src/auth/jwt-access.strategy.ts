import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ① Cookie から取得（ブラウザ用）
        (req: Request) => {
          if (!req || !req.cookies) return null;
          return req.cookies['access_token'] || null;
        },
        // ② Authorization: Bearer から取得（curl / APIクライアント用）
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    // ここで返したオブジェクトが req.user に入る
    return payload;
  }
}
