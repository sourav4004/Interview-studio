# Product Specification

## 1. Product goal

Help college students prepare for campus placements and internships
through realistic, configurable AI interview practice and actionable
feedback.

## 2. Target users

College students preparing for internships and campus placements.
Interface and interview language: English, with speech recognition
tested against Indian English and varied accents.

## 3. Core user journey

1.  Visit landing page.
2.  Continue as guest or sign in/register.
3.  Open Start Interview.
4.  Choose interview type.
5.  Configure role, difficulty, duration, and optional resume/company
    context.
6.  Review the interview summary and privacy disclosures.
7.  Grant required AI-processing consent where needed.
8.  Complete the interview with explicit answer-capture controls.
9.  Wait for evaluation with truthful stage updates.
10. Review report and next-practice recommendation.
11. Registered users can view eligible saved history and progress.
    Guests can view their temporary report while their guest session
    remains valid.

## 4. Interview modes

All four modes are available in the MVP at basic functionality: -
Technical - HR/behavioral - Resume-based - Company-specific

Use a shared interview engine with mode-specific question generation and
evaluation. Company-specific interviews must distinguish user-supplied
context from verified information. If company data is unavailable, offer
a role-based simulation and label it accurately.

## 5. Configuration

-   Default duration: 10 minutes.
-   Default question count: 8.
-   Duration presets: 5, 10, and 20 minutes.
-   Difficulty: Easy, Medium, Hard.
-   Allow resume PDF or pasted resume text when relevant.
-   Company name, role, job description, and known interview context are
    optional where appropriate.
-   Show a review summary before starting.
-   Exact maximum question count and usage quotas must be set after
    latency, provider quota, and cost testing.

## 6. Interview room

-   Interviewer-first layout with a simple SVG/CSS avatar animated using
    Motion.
-   Avatar states: idle, speaking, listening, processing.
-   Question stays readable while spoken.
-   Timer and question progress remain visible.
-   Camera preview is optional and secondary; no video recording or
    visual AI analysis.
-   Student explicitly starts and stops answer capture, reviews
    recognized text, then confirms it.
-   Never automatically submit when speech recognition stops.
-   Text input is a fallback.
-   Realistic mode locks confirmed answers; practice mode allows edits
    before evaluation.
-   Students can pause between questions and resume safely. Timer pauses
    while paused.
-   Skipping is permitted; skipped questions are labeled unanswered and
    are not treated as incorrect answers.
-   Replay is supported. Rephrasing is limited to practice mode;
    realistic mode can replay or clarify without answer hints.
-   No automatic microphone activation after AI speech or resume.

## 7. Evaluation

Evaluate: 1. Answer quality 2. Technical correctness 3. Relevance and
completeness 4. Answer structure 5. Communication/speech 6. Resume
consistency

Output overall score /100 plus dimension scores, evidence, strengths,
priority improvements, and question-level feedback with illustrative
stronger answers/frameworks. Score weights may vary by interview type.
Do not invent facts, credentials, projects, or answers. Mark
insufficient evidence and uncertainty explicitly. Scores estimate
performance on the given interview and must not be presented as
intelligence, personality, or employability judgments.

## 8. Report

Hybrid layout: - Overall score and summary - Six dimension scores and
evidence - Strengths and priority improvements - Expandable
question-by-question review - Example stronger answer or framework - One
primary personalized next step, with Start New Interview as a secondary
action - Clear incomplete/failed status where applicable

Reports are private. No public report-sharing links in MVP. Users can
print/save as PDF using browser print. Guest export is available only
while the guest session remains valid.

## 9. Dashboard

-   Prominent Start Interview action
-   Recent performance and interview list
-   Overall-score trend where enough comparable data exists
-   Strengths, improvement areas, and one prioritized next step
-   Empty states must not fabricate data.
-   General recommendations appear when personalization is disabled or
    evidence is insufficient.
-   Distinguish general from personalized recommendations and show
    last-updated date.

## 10. Personalization

-   Historical-data personalization is separate from saving history for
    the user's own access.
-   Personalization is opt-in and disabled by default.
-   Withdrawing consent immediately blocks future personalization and
    deletes the stored personalization profile and purpose-specific
    derived data.
-   Existing reports and already shown recommendations remain under
    their separate retention policies unless separately deleted or
    otherwise required.
-   After renewed consent, rebuild only from eligible interviews
    completed after the new consent becomes effective.
-   Require at least three eligible post-consent interviews plus
    relevance/sufficiency checks before history-based personalization.
-   Refresh on dashboard visit only when relevant eligible data changed
    and a refresh is warranted.
-   If refresh fails, preserve prior successful recommendations with
    their original update date; retry safely later.
-   Contradictory evidence must be described with caveats, not turned
    into definitive judgments.

## 11. Authentication and guest mode

-   Email/password and Google sign-in using Better Auth, after verifying
    supported capabilities.
-   Guest mode remains available.
-   Permanent progress requires a verified account.
-   Transfer guest results only after verification and explicit consent.
-   Account linking requires existing-account authentication and
    explicit user action; never merge solely because emails match.
-   Session lifecycle: idle timeout 7 days, absolute lifetime 30 days,
    maximum 5 active sessions; server enforced.
-   Secure cookies: Secure, HttpOnly, SameSite=Lax; use
    framework/library CSRF protections plus origin checks as
    appropriate.
-   New/unfamiliar-login alerts are optional; essential security
    notifications remain enabled.

## 12. Error and edge cases

-   Camera denied: continue audio-only if possible.
-   Microphone denied: guide retry and offer text mode; don't start a
    voice-dependent flow without workable input.
-   Speech recognition failure: retry or text fallback.
-   Internet loss: preserve recoverable state, allow safe resume/exit,
    never claim success falsely.
-   Unreadable resume: offer pasted text or non-resume mode.
-   Short answer: mark evidence insufficient rather than inventing
    content.
-   AI question-generation failure: bounded retry, then a complete
    validated fallback set or safe stop. Failed starts do not consume
    usage.
-   Evaluation failure: bounded retries and user-controlled recovery; no
    fake completed report.
-   Background evaluation: durable status and in-app polling; optional
    email notification, which must not block report access.
-   Timer expiry: no new questions; allow finishing current answer or
    explicitly finalize saved answers. Do not abruptly cut off or mark
    missing answers wrong.
-   Consent withdrawal: block new AI processing, cancel pending work
    where safe, discard uncommitted responses arriving after withdrawal,
    preserve only eligible safely persisted state.
-   Deletion: remove app-controlled data and personal analytics
    contributions; don't promise instant removal from backups or
    external providers unless verified.

## 13. Acceptance criteria

-   Every private resource has server-side ownership checks.
-   Every AI response is schema-validated before persistence/use.
-   Reports are marked complete only after validation and durable save.
-   Usage reservations and report generation are idempotent.
-   No permanent audio/video recordings; no visual AI scoring in MVP.
-   Consent is checked on every relevant request, queued job, retry, and
    persistence boundary.
-   Essential user flows have automated tests and a manual smoke test
    before release.
