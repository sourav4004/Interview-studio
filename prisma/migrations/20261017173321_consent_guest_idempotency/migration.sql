-- AlterTable
ALTER TABLE "consent_audit_log" ADD COLUMN     "guestSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "guest_session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "consentAiQuestions" BOOLEAN NOT NULL DEFAULT false,
    "consentAiEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "consentResumeProcessing" BOOLEAN NOT NULL DEFAULT false,
    "noticeVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "guest_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "status" TEXT NOT NULL,
    "responseBody" TEXT,
    "responseCode" INTEGER,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_session_tokenHash_key" ON "guest_session"("tokenHash");

-- CreateIndex
CREATE INDEX "guest_session_expiresAt_idx" ON "guest_session"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_key_expiresAt_idx" ON "idempotency_key"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_key_userId_idx" ON "idempotency_key"("userId");

-- CreateIndex
CREATE INDEX "idempotency_key_guestSessionId_idx" ON "idempotency_key"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_key_scope_key" ON "idempotency_key"("key", "scope");

-- CreateIndex
CREATE INDEX "consent_audit_log_guestSessionId_idx" ON "consent_audit_log"("guestSessionId");

-- AddForeignKey
ALTER TABLE "consent_audit_log" ADD CONSTRAINT "consent_audit_log_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
