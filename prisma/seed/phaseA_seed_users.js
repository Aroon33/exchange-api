"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=== PhaseA Seed: Admin / User / Wallet 作成 ===');
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
                role: client_1.UserRole.ADMIN,
            },
        });
        console.log(`Admin 作成: ${admin.email} / PW: ${adminPasswordPlain}`);
    }
    else {
        console.log(`Admin 既存: ${admin.email}`);
    }
    let group = await prisma.group.findFirst();
    if (!group) {
        group = await prisma.group.create({
            data: {
                name: 'Default Group',
                code: "group-a",
            },
        });
        console.log(`Group 作成: id=${group.id}, name=${group.name}`);
    }
    else {
        console.log(`Group 既存: id=${group.id}, name=${group.name}`);
    }
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
                role: client_1.UserRole.USER,
            },
        });
        console.log(`User 作成: ${user.email} / PW: ${userPasswordPlain}`);
    }
    else {
        console.log(`User 既存: ${user.email}`);
    }
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
//# sourceMappingURL=phaseA_seed_users.js.map