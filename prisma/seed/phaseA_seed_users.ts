import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PhaseA Seed: Admin / User / Wallet 作成 ===');

  // 1. 管理者ユーザー
  const adminEmail = 'admin@example.com';
  const adminPasswordPlain = 'AdminStrongPass123!';
  const adminHash = await bcrypt.hash(adminPasswordPlain, 10);

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        name: 'Admin User',
        role: UserRole.ADMIN,
      },
    });
    console.log(`Admin 作成: ${admin.email} / PW: ${adminPasswordPlain}`);
  } else {
    console.log(`Admin 既存: ${admin.email}`);
  }

  // 3. デフォルトグループ（id=1）を用意
  let group = await prisma.group.findFirst();
  if (!group) {
    group = await prisma.group.create({
      data: {
        name: 'Default Group',
      },
    });
    console.log(`Group 作成: id=${group.id}, name=${group.name}`);
  } else {
    console.log(`Group 既存: id=${group.id}, name=${group.name}`);
  }


  // 2. テスト一般ユーザー
  const userEmail = 'testuser@example.com';
  const userPasswordPlain = 'UserPass123!';
  const userHash = await bcrypt.hash(userPasswordPlain, 10);

  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: userEmail,
        password: userHash,
        name: 'Test User',
        role: UserRole.USER,
      },
    });
    console.log(`User 作成: ${user.email} / PW: ${userPasswordPlain}`);
  } else {
    console.log(`User 既存: ${user.email}`);
  }

  // 3. Wallet 作成 or Upsert
  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      balanceTotal: 0,
      balanceAvailable: 0,
      balanceLocked: 0,
    },
  });
  console.log(`Wallet 準備完了: userId=${wallet.userId}`);

  console.log('=== PhaseA Seed 完了 ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
