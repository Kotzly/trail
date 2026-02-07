-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('MANUAL', 'NOWPAYMENTS');

-- CreateTable
CREATE TABLE "BillingCheckoutSession" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "paymentStatus" TEXT,
    "nowpaymentsInvoiceUrl" TEXT,
    "nowpaymentsPaymentId" TEXT,
    "lastPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutSession_orderId_key" ON "BillingCheckoutSession"("orderId");

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_userId_idx" ON "BillingCheckoutSession"("userId");

-- AddForeignKey
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
