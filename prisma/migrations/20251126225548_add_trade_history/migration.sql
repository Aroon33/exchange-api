-- CreateTable
CREATE TABLE `Trade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `side` VARCHAR(191) NOT NULL,
    `size` DECIMAL(18, 8) NOT NULL,
    `entryPrice` DECIMAL(18, 8) NOT NULL,
    `closePrice` DECIMAL(18, 8) NOT NULL,
    `profit` DECIMAL(18, 8) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NOT NULL,
    `groupId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
