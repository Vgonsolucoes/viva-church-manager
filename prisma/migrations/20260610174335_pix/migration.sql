-- CreateEnum
CREATE TYPE "EventPaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowCreditCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPix" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "paymentMethod" "EventPaymentMethod";

-- CreateTable
CREATE TABLE "EventSale" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentMethod" "EventPaymentMethod" NOT NULL,
    "financeTransactionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSale_financeTransactionId_key" ON "EventSale"("financeTransactionId");

-- CreateIndex
CREATE INDEX "EventSale_eventId_idx" ON "EventSale"("eventId");

-- CreateIndex
CREATE INDEX "EventSale_paymentMethod_idx" ON "EventSale"("paymentMethod");

-- CreateIndex
CREATE INDEX "EventSale_createdAt_idx" ON "EventSale"("createdAt");

-- CreateIndex
CREATE INDEX "Event_isPaid_idx" ON "Event"("isPaid");

-- CreateIndex
CREATE INDEX "FinanceTransaction_eventId_idx" ON "FinanceTransaction"("eventId");

-- AddForeignKey
ALTER TABLE "EventSale" ADD CONSTRAINT "EventSale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSale" ADD CONSTRAINT "EventSale_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSale" ADD CONSTRAINT "EventSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
