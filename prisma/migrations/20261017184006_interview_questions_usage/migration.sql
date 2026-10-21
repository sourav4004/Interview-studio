/*
  Warnings:

  - Added the required column `difficulty` to the `interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationMinutes` to the `interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionCount` to the `interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionSource` to the `interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `interview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "interview" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "difficulty" TEXT NOT NULL,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL,
ADD COLUMN     "guestSessionId" TEXT,
ADD COLUMN     "jobDescription" TEXT,
ADD COLUMN     "modelIdentifier" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "questionCount" INTEGER NOT NULL,
ADD COLUMN     "questionSource" TEXT NOT NULL,
ADD COLUMN     "resumeText" TEXT,
ADD COLUMN     "role" TEXT NOT NULL,
ADD COLUMN     "schemaVersion" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "interview_question" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "category" TEXT,
    "difficulty" TEXT,
    "source" TEXT NOT NULL,
    "timeLimitSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "interviewId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "unitsReserved" INTEGER NOT NULL DEFAULT 1,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_question_interviewId_idx" ON "interview_question"("interviewId");

-- CreateIndex
CREATE INDEX "usage_record_userId_idx" ON "usage_record"("userId");

-- CreateIndex
CREATE INDEX "usage_record_guestSessionId_idx" ON "usage_record"("guestSessionId");

-- CreateIndex
CREATE INDEX "usage_record_status_idx" ON "usage_record"("status");

-- CreateIndex
CREATE INDEX "usage_record_createdAt_idx" ON "usage_record"("createdAt");

-- CreateIndex
CREATE INDEX "interview_guestSessionId_idx" ON "interview"("guestSessionId");

-- CreateIndex
CREATE INDEX "interview_status_idx" ON "interview"("status");

-- AddForeignKey
ALTER TABLE "interview" ADD CONSTRAINT "interview_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_question" ADD CONSTRAINT "interview_question_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
