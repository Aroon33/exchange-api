"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=== Seed Trades Start ===');
    const user = await prisma.user.findUnique({
        where: { email: 'testuser@example.com' },
    });
    if (!user) {
        console.log('testuser@example.com が見つかりません。先に phaseA_seed_users を実行してください。');
        return;
    }
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
            profit: 10,
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
            profit: 50,
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
            profit: -20,
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
//# sourceMappingURL=seed_trades.js.map