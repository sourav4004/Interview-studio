-- CreateTable
CREATE TABLE "personalization_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "consentGrantedAt" TIMESTAMP(3) NOT NULL,
    "consentNoticeVersion" TEXT NOT NULL DEFAULT '1.0',
    "eligibleReportCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleReportIds" TEXT[],
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileData" JSONB NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalization_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personalization_profile_userId_key" ON "personalization_profile"("userId");

-- CreateIndex
CREATE INDEX "personalization_profile_userId_idx" ON "personalization_profile"("userId");

-- CreateIndex
CREATE INDEX "personalization_profile_status_idx" ON "personalization_profile"("status");

-- AddForeignKey
ALTER TABLE "personalization_profile" ADD CONSTRAINT "personalization_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
