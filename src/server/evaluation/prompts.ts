/**
 * Versioned Evaluation Prompts.
 *
 * Implements:
 * - Versioned system & user prompt templates per ARCHITECTURE.md (Section 6)
 * - Grounding rules from PRODUCT_SPEC.md (Section 7: Evaluation)
 * - Strict adherence to evidence, non-stigmatizing framing, and privacy rules
 */

import { InterviewEvaluationRequest } from "./types";

export const EVALUATION_PROMPT_VERSION = "1.0";

export const EVALUATION_SYSTEM_PROMPT = `You are a fair, expert technical and behavioral interview evaluator.
Your role is to evaluate candidate responses for a simulated mock interview and produce objective, actionable feedback.

CORE EVALUATION PRINCIPLES:
1. Grounding in Evidence:
   - Base all evaluations strictly on the candidate's actual submitted answer transcripts.
   - For every score and critique, cite specific phrases or concepts from the candidate's response.
   - NEVER fabricate quotes, candidate background, projects, or credentials.

2. Fair Treatment of Edge Cases:
   - For skipped or unanswered questions: Do NOT treat them as incorrect or assign arbitrary zero scores. Set score to null and provide an illustrative framework or sample response.
   - For brief or partial answers: Distinguish between "insufficient_evidence" and poor performance. If an answer is too brief to evaluate a dimension, set status to "insufficient_evidence" with score null.
   - Speech Recognition Artifacts: Focus on the substance of the ideas, reasoning, and technical terms. Do not severely penalize obvious automated speech-to-text mistranscriptions.

3. Non-Stigmatizing, Context-Specific Framing:
   - Scores evaluate performance in this specific interview session only.
   - Never present scores or feedback as judgments on the candidate's general intelligence, personality, or universal employability.
   - Avoid condescending, overly punitive, or artificially flattering language.

4. Actionable Improvements:
   - Highlight 2-3 genuine strengths demonstrated by the candidate.
   - Provide concrete, constructive steps to improve.
   - For each answered question, include a concise, realistic example of a stronger answer or framework (e.g. STAR framework for behavioral, trade-off analysis for technical).

5. Dimension Handling:
   - Evaluate dimensions:
     * answer_quality
     * technical_correctness (mark not_applicable if mode is behavioral)
     * relevance_completeness
     * answer_structure
     * communication_speech
     * resume_consistency (only score if resume context is provided, otherwise mark not_applicable)
   - Ensure dimension scores are between 0 and 100, or null when not applicable or insufficient evidence.

SCHEMA (Use EXACT property names):
{
  "summary": "Overall executive summary of candidate performance (min 10 chars)",
  "strengths": ["Grounded strength 1", "Grounded strength 2"],
  "improvements": ["Actionable improvement 1", "Actionable improvement 2"],
  "primaryRecommendation": "One concrete next-step practice activity",
  "dimensionScores": [
    {
      "dimension": "answer_quality | technical_correctness | relevance_completeness | answer_structure | communication_speech | resume_consistency",
      "score": 85,
      "status": "scored | not_applicable | insufficient_evidence",
      "explanation": "Detailed explanation citing candidate answers",
      "evidence": "Specific phrases from answers"
    }
  ],
  "questionFeedback": [
    {
      "questionId": "ID matching the question ID",
      "score": 85,
      "explanation": "Assessment of response",
      "evidence": "Direct quote or concept from candidate",
      "strengths": ["Strength point"],
      "improvements": ["Improvement suggestion"],
      "exampleAnswer": "Illustrative stronger answer"
    }
  ]
}

Return ONLY a valid JSON object matching the requested schema.`;

export function buildEvaluationPrompt(request: InterviewEvaluationRequest): string {
  const parts: string[] = [];

  parts.push(`INTERVIEW SESSION CONTEXT:`);
  parts.push(`- Role: ${request.role}`);
  parts.push(`- Interview Mode: ${request.mode}`);
  parts.push(`- Difficulty: ${request.difficulty}`);
  if (request.companyName) {
    parts.push(`- Target Company: ${request.companyName}`);
  }
  if (request.jobDescription) {
    parts.push(`- Job Description / Context: ${request.jobDescription}`);
  }
  if (request.hasResumeConsent && request.resumeText) {
    parts.push(`- Candidate Resume Summary (Authorized for consistency evaluation):`);
    parts.push(request.resumeText.slice(0, 4000));
  }

  parts.push(`\nQUESTIONS AND SUBMITTED ANSWERS:`);
  for (const q of request.questions) {
    parts.push(`\n--- Question ${q.orderIndex + 1} (ID: ${q.id}) ---`);
    parts.push(`Category: ${q.category || "General"}`);
    parts.push(`Question: ${q.questionText}`);

    if (!q.answer || q.answer.status === "skipped" || !q.answer.transcript.trim()) {
      parts.push(`Status: [SKIPPED / UNANSWERED]`);
      parts.push(`Answer: (Candidate skipped this question)`);
    } else {
      parts.push(`Status: [SUBMITTED]`);
      parts.push(`Input Mode: ${q.answer.inputMode}`);
      parts.push(`Candidate Answer:\n${q.answer.transcript}`);
    }
  }

  parts.push(`\nEVALUATION INSTRUCTIONS:`);
  parts.push(`Evaluate the candidate's overall performance across the 6 dimensions.`);
  parts.push(`Produce:`);
  parts.push(`1. Overall executive summary.`);
  parts.push(`2. Key strengths (2-4 bullet points grounded in answers).`);
  parts.push(`3. Priority improvement areas (2-4 actionable bullet points).`);
  parts.push(`4. One primary personalized next step recommendation.`);
  parts.push(`5. Dimension evaluations for each of the 6 dimensions:`);
  parts.push(`   - answer_quality`);
  parts.push(`   - technical_correctness (score 0-100 or null if not_applicable)`);
  parts.push(`   - relevance_completeness`);
  parts.push(`   - answer_structure`);
  parts.push(`   - communication_speech`);
  parts.push(`   - resume_consistency (score 0-100 if resume provided, else null with status 'not_applicable')`);
  parts.push(`6. Question feedback for each question:`);
  parts.push(`   - score (0-100 or null if skipped)`);
  parts.push(`   - explanation`);
  parts.push(`   - evidence (quote or reference specific parts of candidate answer)`);
  parts.push(`   - strengths (array of strings)`);
  parts.push(`   - improvements (array of strings)`);
  parts.push(`   - exampleAnswer (a concise, illustrative stronger answer or outline)`);

  return parts.join("\n");
}
