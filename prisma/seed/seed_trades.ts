import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seed Trades Start ===');

  // testuser の ID を取得（email で検索）
  const user = await prisma.user.findUnique({
    where: { email: 'testuser@example.com' },
  });

  if (!user) {
    console.log('testuser@example.com が見つかりません。先に phaseA_seed_users を実行してください。');
    return;
  }

  // 既存の Trade を一旦削除（デモ用）
  await prisma.trade.deleteMany({
    where: { userId: user.id },
  });

  const now = new Date();
  const oneHour = 1000 * 60 * 60;

  const tradesData = [
    {
      userId: user.id,
      symbol: 'BTCUSDT',
      side: 'BUY',
      size: 0.01,
      entryPrice: 65000,
      closePrice: 66000,
      profit: 10,                 // +10 USDT のイメージ
      openedAt: new Date(now.getTime() - 10 * oneHour),
      closedAt: new Date(now.getTime() - 9 * oneHour),
      groupId: user.groupId ?? null,
    },
    {
      userId: user.id,
      symbol: 'ETHUSDT',
      side: 'SELL',
      size: 0.5,
      entryPrice: 3500,
      closePrice: 3400,
      profit: 50,                 // +50 USDT
      openedAt: new Date(now.getTime() - 8 * oneHour),
      closedAt: new Date(now.getTime() - 7 * oneHour),
      groupId: user.groupId ?? null,
    },
    {
      userId: user.id,
      symbol: 'XAUUSD',
      side: 'BUY',
      size: 0.1,
      entryPrice: 2300,
      closePrice: 2280,
      profit: -20,                // -20 USDT
      openedAt: new Date(now.getTime() - 5 * oneHour),
      closedAt: new Date(now.getTime() - 4 * oneHour),
      groupId: user.groupId ?? null,
    },
  ];

  await prisma.trade.createMany({
    data: tradesData,
  });

  console.log('=== Seed Trades Done ===');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
