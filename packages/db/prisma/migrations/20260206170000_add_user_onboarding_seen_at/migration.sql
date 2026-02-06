-- AlterTable
ALTER TABLE "User"
ADD COLUMN "onboardingSeenAt" TIMESTAMP(3);

-- Existing users are considered already onboarded.
UPDATE "User"
SET "onboardingSeenAt" = NOW()
WHERE "onboardingSeenAt" IS NULL;
