-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "UserSubscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "interval" "SubscriptionInterval" NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "pendingInterval" "SubscriptionInterval";
