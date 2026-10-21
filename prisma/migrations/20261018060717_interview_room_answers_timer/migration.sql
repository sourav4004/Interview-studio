-- AlterTable
ALTER TABLE "interview" ADD COLUMN     "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "isPracticeMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPausedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalPauseDurationSeconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "interview_answer" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "inputMode" TEXT NOT NULL DEFAULT 'speech',
    "durationSeconds" INTEGER,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_answer_questionId_key" ON "interview_answer"("questionId");

-- CreateIndex
CREATE INDEX "interview_answer_interviewId_idx" ON "interview_answer"("interviewId");

-- AddForeignKey
ALTER TABLE "interview_answer" ADD CONSTRAINT "interview_answer_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answer" ADD CONSTRAINT "interview_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "interview_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
