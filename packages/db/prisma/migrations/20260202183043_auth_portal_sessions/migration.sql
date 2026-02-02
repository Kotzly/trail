-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "locale" TEXT,
    "returnUrl" TEXT,
    "userId" TEXT,
    "extensionToken" TEXT,
    "extensionTokenExpiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
