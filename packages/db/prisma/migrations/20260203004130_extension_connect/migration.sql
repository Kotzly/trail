-- CreateTable
CREATE TABLE "ExtensionConnectSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionConnectSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtensionConnectSession_expiresAt_idx" ON "ExtensionConnectSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ExtensionConnectSession_userId_idx" ON "ExtensionConnectSession"("userId");

-- AddForeignKey
ALTER TABLE "ExtensionConnectSession" ADD CONSTRAINT "ExtensionConnectSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
