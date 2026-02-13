CREATE INDEX "Trail_userId_deletedAt_updatedAt_id_idx"
ON "Trail"("userId", "deletedAt", "updatedAt", "id");

CREATE INDEX "Trail_userId_updatedAt_idx"
ON "Trail"("userId", "updatedAt");
