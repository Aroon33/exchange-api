import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin.auth.controller';
import { AuthModule } from '../../auth/auth.module';
import { AuthService } from '../../auth/auth.service'; // ← ★追加

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [AdminAuthController],

  // ★ ここを追加（確認用）
  providers: [AuthService],
})
export class AdminAuthModule {}
