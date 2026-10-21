-- CreateTable
CREATE TABLE "interview_report" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overallScore" INTEGER,
    "summary" TEXT,
    "scoreExplanation" TEXT,
    "strengths" TEXT[],
    "improvements" TEXT[],
    "primaryRecommendation" TEXT,
    "dimensionScores" JSONB NOT NULL,
    "questionFeedback" JSONB NOT NULL,
    "modelIdentifier" TEXT,
    "promptVersion" TEXT,
    "rubricVersion" TEXT,
    "schemaVersion" TEXT,
    "evaluatedAnswersCount" INTEGER NOT NULL DEFAULT 0,
    "skippedAnswersCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_report_interviewId_key" ON "interview_report"("interviewId");

-- CreateIndex
CREATE INDEX "interview_report_userId_idx" ON "interview_report"("userId");

-- CreateIndex
CREATE INDEX "interview_report_guestSessionId_idx" ON "interview_report"("guestSessionId");

-- CreateIndex
CREATE INDEX "interview_report_status_idx" ON "interview_report"("status");

-- AddForeignKey
ALTER TABLE "interview_report" ADD CONSTRAINT "interview_report_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_report" ADD CONSTRAINT "interview_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_report" ADD CONSTRAINT "interview_report_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
