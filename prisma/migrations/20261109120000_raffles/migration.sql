BEGIN;

-- CreateTable
CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "firstNumber" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "authorization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleTicket" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "memberId" TEXT,
    "participantName" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleResult" (
    "raffleId" TEXT NOT NULL,
    "winningNumber" INTEGER NOT NULL,
    "winnerName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paidCount" INTEGER NOT NULL,
    "reservedCount" INTEGER NOT NULL,
    "raisedCents" INTEGER NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleResult_pkey" PRIMARY KEY ("raffleId")
);

-- CreateIndex
CREATE INDEX "RaffleTicket_memberId_createdAt_idx" ON "RaffleTicket"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleTicket_raffleId_number_key" ON "RaffleTicket"("raffleId", "number");

-- AddForeignKey
ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleResult" ADD CONSTRAINT "RaffleResult_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
