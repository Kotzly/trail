-- CreateTable
CREATE TABLE "ExtensionLoginCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionLoginCode_code_key" ON "ExtensionLoginCode"("code");

-- CreateIndex
CREATE INDEX "ExtensionLoginCode_expiresAt_idx" ON "ExtensionLoginCode"("expiresAt");

-- CreateIndex
CREATE INDEX "ExtensionLoginCode_userId_idx" ON "ExtensionLoginCode"("userId");

-- AddForeignKey
ALTER TABLE "ExtensionLoginCode" ADD CONSTRAINT "ExtensionLoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
