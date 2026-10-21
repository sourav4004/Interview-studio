# Architecture and Product Decisions

## Status convention

`Finalized` means selected in planning. `Verify before implementation`
means the product choice is made but a current external provider/legal
fact must be checked.

## Product and experience

-   Full-stack Next.js modular monolith.
-   English-only MVP for college students preparing for internships and
    campus placements.
-   Four interview types at launch: technical, HR/behavioral,
    resume-based, company-specific.
-   Default 10 minutes and 8 questions; durations 5/10/20 minutes.
-   Difficulty: Easy, Medium, Hard.
-   Realistic mode locks confirmed answers; practice mode allows editing
    before evaluation.
-   Guided setup, explicit start/stop answer capture, transcript
    confirmation, controlled pause/exit, skip/replay, bounded
    follow-ups.
-   Simple SVG/CSS avatar with Motion states; no expensive real-time 3D
    in MVP.
-   Browser-first hybrid speech with text fallback.
-   No permanent audio/video recordings and no visual AI scoring.
-   Private web reports; browser print/Save as PDF; no public sharing
    links.
-   General recommendations when personalization is disabled or evidence
    is insufficient.

## Technical stack

-   Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React,
    Motion.
-   Neon PostgreSQL and Prisma.
-   Better Auth.
-   Google Gemini API through replaceable provider adapter.
-   React Hook Form + Zod.
-   Mozilla PDF.js, no OCR initially.
-   Resend for transactional email.
-   Inngest preferred candidate for background jobs pending
    verification.
-   Vercel hosting and GitHub CI/CD.
-   Figma design workflow.

## Security and reliability

-   Server-side ownership checks on all private resources.
-   Database constraints and transactions for critical state
    transitions.
-   Idempotent quota reservations, report generation, email/webhook
    processing, and deletion workflows.
-   Secure HTTP-only session cookies, SameSite=Lax, Secure in
    production; 7-day idle and 30-day absolute lifetime; maximum 5
    active sessions.
-   Password reset tokens: 30 minutes; verification links: 24 hours;
    verification resend cooldown: 60 seconds; unverified email/password
    accounts deleted after 7 days, with one reminder around day 5.
-   Password minimum 8 characters, maximum 128, common-password
    protection, no arbitrary composition rules.
-   No MFA in MVP.
-   Rate limiting with selective Turnstile challenge on suspicious auth
    activity, subject to provider/privacy verification.
-   CSP report-only during development/preview; enforce after testing
    before public launch.
-   HSTS one year in production after HTTPS is confirmed; no
    includeSubDomains/preload without separate review.
-   PDF upload max 4 MB/20 pages; resume text max 20,000 chars; combined
    optional context max 10,000 chars.
-   Production migrations use controlled `prisma migrate deploy`, not
    `db push`.
-   Testing includes unit, integration, E2E, AI benchmark,
    security/privacy, accessibility, and release smoke tests.

## Privacy and consent

-   Purpose-specific consent for question generation, answer
    evaluation/report generation, current resume processing,
    saved-resume storage, and historical-data personalization.
-   Required AI consent explicit; saved resume and personalization
    opt-in and off by default.
-   Consent withdrawal immediately blocks future processing; queued
    jobs/retries must recheck consent.
-   Only validated and persisted results from before withdrawal remain
    eligible; discard uncommitted responses arriving after withdrawal.
-   Saved-resume storage withdrawal deletes saved resume, reusable
    extracted text/copies/caches, and resume-derived evidence excerpts
    in historical reports; preserve scores/feedback where possible and
    mark evidence unavailable.
-   Historical personalization withdrawal deletes stored profile and
    purpose-specific derived data. Existing recommendations/reports
    remain under their separate policies unless separately deleted.
-   After renewed consent, rebuild profile only from eligible interviews
    completed after renewed consent.
-   Minimum three eligible post-consent interviews plus evidence quality
    check before historical-data personalization.
-   Refresh only when relevant eligible data changed and a refresh is
    warranted, on dashboard visit. If refresh fails, retain prior
    successful recommendations with original timestamp.
-   No raw AI payloads in operational logs. Log minimal metadata only.
-   Registered interview data retained until user deletes it, subject to
    documented exceptions and applicable law. Temporary company context
    deleted after finalization; failed evaluation recovery context up to
    24 hours.
-   Individual interview deletion removes contribution to personal
    analytics. Account deletion revokes access immediately, then
    performs retryable cleanup. Backups expire under documented
    schedule; don't promise immediate backup/provider erasure.
-   Privacy notice must accurately describe providers, purposes,
    categories, and limitations.
-   Milestone 4 implementation decisions (2026-10-17):
    - Purpose-specific consent modeled via `UserConsent` with 5 granular purposes (`ai_questions`, `ai_evaluation`, `resume_processing`, `saved_resume`, `personalization`) and notice versioning (`"1.0"`).
    - Immutable audit trail in `ConsentAuditLog` recorded atomically via Prisma interactive transaction on every grant and withdrawal action.
    - Server-side fail-closed consent enforcement: `assertConsent` and `assertRequiredAiConsent` throw `ConsentRequiredError` if consent is not active and current, or `ConsentUnavailableError` if database query fails.
    - Guest session token security: 32-byte cryptographically secure random token generated on server; client receives raw token once; server persists ONLY deterministic SHA-256 hash (`tokenHash`) in `GuestSession`. Lookups and validations hash inbound token before database queries.
    - Guest sessions expire strictly after 24 hours (`GUEST_SESSION_DURATION_MS = 86_400_000`); server-side assertions (`assertGuestOwnership`, `assertResourceAccess`) verify session validity and resource ownership.
    - Idempotent execution wrapper (`withIdempotency`): database-backed locking via `IdempotencyKey` table with `[key, scope]` uniqueness, 30-second concurrency lock timeout, and cached JSON replay (`replayed: true`) upon completion. Failures unlock keys to allow legitimate retries.
-   Milestone 5 implementation decisions (2026-10-18):
    - Server-only replaceable AI adapter architecture (`AiProviderAdapter`) with concrete `GeminiProviderAdapter` and `MockAiProviderAdapter`. Credentials read exclusively from server environment (`GEMINI_API_KEY`, `GEMINI_MODEL`).
    - Configurable Gemini model identifier defaults to `gemini-3.5-flash-lite` with dynamic override via `process.env.GEMINI_MODEL`.
    - Strict structured output validation via Zod schemas (`GeneratedQuestionSchema`, `QuestionSetSchema`), including case- and punctuation-normalized duplicate question detection and question count verification.
    - Versioned prompt templates (`PROMPT_VERSION = "1.0"`, `SCHEMA_VERSION = "1.0"`) maintaining strict isolation between system instructions and untrusted user context (job descriptions, resume text) to resist prompt-injection attacks.
    - Reviewed fallback question bank (`BANK_VERSION = "1.0"`) covering all 4 modes (Technical, Behavioral, Resume, Company) across Easy, Medium, and Hard difficulties, ensuring zero duplicate questions and graceful offline operation.
    - Atomic usage quota reservation: `reserveUsage` checks consumption in rolling 24-hour window before calling AI. On AI success, reservation commits with actual token counts; on AI failure or fallback transition, reservation is released so failed attempts do not consume student quota.
    - Database persistence: `Interview` and `InterviewQuestion` records created transactionally upon validated question set generation, stamped with source attribution (`"gemini"` or `"fallback"`).


## UI/design

-   Premium gradient direction; palette: indigo `#4F46E5`, violet
    `#7C3AED`, soft indigo `#EEF2FF`, white `#FFFFFF`, charcoal
    `#171827`; verify contrast.
-   Font: Inter.
-   Balanced responsive layout: spacious landing page, efficient
    dashboard, focused interview room.
-   Desktop dashboard sidebar, mobile adaptation; simplified
    active-interview UI.
-   Figma wireframes before polished screens; design system before
    individual screen polish.

## Release and workflow

-   Private beta before public launch.
-   No unresolved critical/high security/privacy issues before release.
-   Coding agent workflow: Inspect → Plan → Implement → Verify.
-   Small tasks, acceptance criteria, tests, verified milestones,
    commits.
-   Repository-first context when switching AI tools.
-   Do not implement all features in one giant change.

## Verify before implementation

-   Current Gemini model availability, quotas, pricing,
    retention/data-use terms.
-   Vercel Hobby plan personal/commercial limits.
-   Neon limits, connection behavior, backups/PITR and region options.
-   Resend sending limits, verified-domain requirements, webhook events.
-   Inngest free tier, execution duration/retries and Vercel
    compatibility.
-   Better Auth support for selected flows and session controls: Verified on 2026-10-17.
    Pinned `better-auth@1.7.10` and `@better-auth/prisma-adapter@1.7.10`.
    Verified capabilities:
    - Natively supports sliding idle expiration (`expiresIn: 604800` / 7 days, `updateAge: 86400` / 1 day) and 5-minute cookie caching.
    - Does not offer built-in simultaneous dual idle/absolute expiration or a global 5-session limit.
    - Implemented 5-session cap via `databaseHooks.session.create.before` hook by pruning excess sessions.
    - Implemented 30-day absolute expiration cutoff via `getCurrentSession` server-side evaluation.
    - Configured secure cookie attributes (`httpOnly: true`, `sameSite: "lax"`, `secure` in production).
    - Email verification configured for 24-hour token lifetime (`expiresIn: 86400`).
    - Google OAuth configured conditionally, pending verified Google Cloud Console credentials.
-   Current legal obligations for target markets, including India.
    Record source, check date, and conclusion before depending on each
    fact.

## Milestone 6 --- Interactive Interview Room

Recorded on 2026-10-18:
-   **Finite State Machine Architecture**: Interactive interview room lifecycle uses an explicit, deterministic state machine (`ready`, `asking_question`, `listening`, `confirming_answer`, `paused`, `processing`, `completed`, `safely_exited`) in `src/lib/interview-machine.ts`. All state transitions are guarded by `canTransition` and `transitionInterviewState`.
-   **Interviewer Avatar Representation**: Lightweight SVG/CSS animated interviewer avatar (`src/components/interview/Avatar.tsx`) with 4 distinct visual states: `idle`, `speaking`, `listening`, and `processing`. Visual state is purely derived from machine state and speech synthesis playback. Zero heavy 3D or WebGL dependencies.
-   **Browser Speech Adapter & Privacy Guardrails**: `src/lib/speech.ts` implements Web Speech API recognition and synthesis with strict privacy guarantees:
    - Feature detection for `webkitSpeechRecognition` / `SpeechRecognition` and `SpeechSynthesis`.
    - Microphones are **never** automatically activated upon question display. Candidates must explicitly click the microphone button to start listening.
    - Interim transcript stream displays in real time with audio pulse indicator; speech recognition is finalized on candidate action or silence.
    - Answers are **never** auto-submitted. Transcripts are populated into an accessible, editable text area requiring explicit user confirmation before server submission.
    - Fully accessible text-input fallback is always available for environments without browser speech recognition or where users prefer typing.
-   **Server-Derived Countdown & Pause Tracking**: Interview timer countdown is computed on the server using database-persisted timestamps (`startedAt`, `endedAt`, `lastPausedAt`, `totalPauseDurationSeconds`) to prevent client-side timer manipulation.
    - Active elapsed seconds subtract accumulated pause duration.
    - Countdown expiration is verified on the server upon state actions and answer submissions.
-   **Answer Persistence & Realistic Mode Locks**:
    - Answers are persisted to the `InterviewAnswer` table (`id`, `interviewId`, `questionId`, `transcript`, `rawTranscript`, `status`, `inputMode`, `durationSeconds`, `isEdited`).
    - In Realistic Mode (`isPracticeMode: false`), once an answer is submitted, it is permanently locked against modifications (throwing `InterviewAnswerLockedError`, HTTP 409).
    - In Practice Mode (`isPracticeMode: true`), candidates may revise and re-submit answers prior to interview completion.
    - Questions can be skipped with status `"skipped"` and blank transcript.
-   **Disaster Recovery**: Unsubmitted edits are mirrored into client-side `sessionStorage` (`draft_answer_{interviewId}_{questionId}`) and cleared upon confirmed server write, protecting candidate effort against network or page refreshes.

## Milestone 7 --- AI Evaluation and Interview Reports

Recorded on 2026-10-18:
-   **Evaluation Rubrics & Dimension Weighting**:
    - Evaluates 6 core dimensions: `answer_quality`, `technical_correctness`, `relevance_completeness`, `answer_structure`, `communication_speech`, and `resume_consistency`.
    - Mode-specific weights matrix (`RUBRIC_WEIGHTS_BY_MODE` in `src/server/evaluation/rubrics.ts`):
      - **Technical**: Technical correctness (35%), Answer quality (20%), Relevance & completeness (15%), Structure (15%), Communication (15%), Resume consistency (N/A).
      - **Behavioral**: Answer structure (25%), Communication (25%), Answer quality (25%), Relevance & completeness (25%), Technical correctness (N/A), Resume consistency (N/A).
      - **Resume**: Resume consistency (30%), Technical correctness (20%), Answer quality (20%), Relevance & completeness (15%), Communication (15%), Structure (N/A).
      - **Company**: Relevance & completeness (30%), Technical correctness (20%), Answer quality (20%), Structure (15%), Communication (15%), Resume consistency (N/A).
    - Dimensions marked `not_applicable` or `insufficient_evidence` are omitted from weighting rather than penalized as 0; remaining applicable weights are normalized to sum to 100%.
    - Non-stigmatizing score explanations: Scores explicitly describe performance in the context of the simulated questions, role, and difficulty level, with clear notices that they do not represent general intelligence, personality, or universal employability.
-   **Strict Zod Schema Validation & Output Grounding**:
    - `RawModelEvaluationResponseSchema` validates every response before database persistence.
    - Model outputs must cite concrete phrases/concepts from submitted candidate transcripts; fabricated quotations or background are rejected.
    - Skipped and unanswered questions are preserved with `score: null` and status `skipped` or `unanswered`, never treated as failed or incorrect.
-   **Atomic Quota Reservation & Idempotency Pipeline**:
    - Quota is atomically reserved before calling Gemini (`reserveUsage(actor, "evaluation", interviewId)`).
    - On success: `commitUsage` persists token usage metadata.
    - On failure: `releaseUsage` safely releases the reservation so candidates are never charged for failed evaluation attempts.
    - Consent boundary enforcement: `assertConsent(userId, "ai_evaluation")` (or guest session consent) is checked before model invocation and re-verified at the persistence boundary.
    - Idempotent execution: if a completed report already exists, `generateInterviewReport` returns it immediately without invoking Gemini or consuming usage quota.
-   **Database & Migration Strategy**:
    - Created `InterviewReport` model with direct relations to `Interview`, `User`, and `GuestSession`.
    - Generated and deployed migration `20261018094000_interview_reports` via `prisma migrate deploy` to PostgreSQL.
-   **Hybrid Report UX & Print-Friendly Layout**:
    - Responsive hybrid report layout (`src/app/interview/[id]/report/page.tsx`) with overall score gauge, 6 dimension cards with evidence quotes, strengths/improvements grid, primary recommended next step, and question-by-question review with illustrative stronger answers.
    - Print-friendly CSS (`@media print` rules) hides navigation, buttons, and backgrounds while ensuring all question reviews are printed cleanly.

## Milestone 8 --- Dashboard, Interview History & Performance Trends

Recorded on 2026-10-18:
-   **Candidate Dashboard Architecture & Performance Metrics**:
    - Implemented authenticated candidate dashboard (`src/app/(workspace)/dashboard/page.tsx`) replacing application shell placeholders.
    - Four real-time candidate metrics computed solely from verified, completed reports:
      1. `totalCompleted`: Count of eligible completed reports (along with total initiated sessions).
      2. `recentScore`: Most recent valid overall score (/100) from the latest completed report.
      3. `averageScore`: Arithmetic mean of valid overall scores across eligible completed reports.
      4. `strongestDimension`: Highest-scoring evaluation dimension with verified evidence; null if insufficient evidence.
    - General placement recommendation card contextualized by completed interview history without claiming definitive capability assessments.
-   **Zero Synthetic Curves & Strict Minimum Data Rules**:
    - **N = 0**: Helpful empty state instructing candidates to complete their first diagnostic interview. No mock scores or invented averages.
    - **N = 1**: Baseline card displaying the single verified score (/100), explicitly noting that at least two sessions in that mode are required to render an observed trendline.
    - **N >= 2**: Chronological SVG trajectory curve displaying real completion timestamps, score range, and observed point changes.
-   **Dimension Comparability & Zero-Penalty Safeguards**:
    - Non-evaluated dimensions (`not_applicable` or `insufficient_evidence`) are **never** treated as zero.
    - Dimension benchmark averages only aggregate points where `status === "scored"` and score is numeric.
    - The UI presents "Not Evaluated" or "Insufficient Evidence" badges with accessible status labels instead of zero score gauges.
    - Mode differentiation: Exposes interview mode on all trajectory data points and allows mode-filtered comparisons to respect differing rubric weights.
-   **Interview History Retrieval & Data Minimization**:
    - Bounded server-side pagination (default 10, max 50) via `getInterviewHistory` in `src/server/dashboard/service.ts`.
    - Support for mode and status filtering (`technical`, `behavioral`, `resume`, `company`, `completed`, `in_progress`, `safely_exited`, `failed`).
    - Minimizes returned database fields: retrieves only summary metadata (`id`, `interviewType`, `role`, `difficulty`, `status`, `durationMinutes`, `questionCount`, `companyName`, `createdAt`, `report.id`, `report.status`, `report.overallScore`), omitting bulky `transcript`, `resumeText`, `jobDescription`, and detailed evaluation payloads.
-   **Server-Side Security Actor Resolution & Ownership Isolation**:
    - Created unified actor resolution helper (`src/server/auth/actor.ts`) resolving registered users from Better Auth sessions and guests from cryptographically validated guest session tokens.
    - Guest sessions can only query records where `guestSessionId === actor.guestSessionId && userId === null`.
    - Registered users can only query records where `userId === actor.userId`.
    - API endpoints (`GET /api/interviews/dashboard` and `GET /api/interviews/history`) enforce authentication, rejecting unauthenticated actors with HTTP 401.
-   **Accessible Charting & Responsive Design System**:
    - Built pure SVG/CSS responsive trendline chart (`src/components/dashboard/ScoreTrendChart.tsx`) without adding heavy charting dependencies.
    - Full screen-reader support via semantic roles, descriptive `aria-label`, interactive data point focus, and a textual summary.
    - Complies with approved Indigo/Violet design tokens, Inter typography, and WCAG 2.2 AA contrast rules.

## Milestone 8.1 --- Targeted Analytics & Privacy Audit

Recorded on 2026-10-18:
-   **Recommendation Personalization Consent Enforcement**:
    - Audited the "Recommended Next Step" logic. Formerly, the client component inspected `strongestDimension` without checking the user's granular consent state for `personalization`.
    - Server-side enforcement added: `getDashboardAnalytics` explicitly queries `getUserConsent(actor.userId)`.
    - If `personalization` consent is disabled, missing, withdrawn, or for guest sessions (which do not support cross-session personalization), the system strictly returns non-personalized general practice guidance. Historical interview evaluation data and dimension scores are never used to derive recommendations without opt-in consent.
    - Returns structured `recommendation` payload with `isPersonalized`, `category` ("general" | "personalized"), `guidance`, and `lastUpdated`.
    - Dashboard UI dynamically reflects recommendation category with "Personalized Recommendation" or "General Placement Guidance" badges and explicit `lastUpdated` timestamps per `PRODUCT_SPEC.md` Section 9.
-   **Cross-Mode Score Trends & Comparability Safeguards**:
    - Audited `ScoreTrendChart.tsx` and the aggregation service. Previously, the "All Modes" view drew a single unbroken polyline connecting scores across different interview modes (e.g. Technical and Behavioral), which use different rubric weights and scoring criteria.
    - The chart was corrected to render separate mode-specific series (Technical in indigo `#4F46E5`, Behavioral in violet `#8B5CF6`, Resume in teal `#0D9488`, Company in amber `#D97706`). Points from different modes are never connected on the same line.
    - Mode series legend added to the "All Modes" view.
    - Rubric version segmentation: within a mode series, points across differing rubric versions are segmented rather than drawn as an unbroken line, preventing misleading trend comparisons across rubric changes.
    - In `service.ts`, `trendSummary` avoids claiming an observed point change from baseline across differing modes. If reports span multiple modes or rubric versions, clear context notices are provided. Historical scores are never recalculated using current rubrics.
-   **Dimension Aggregates & Strongest-Dimension Claims**:
    - Confirmed that dimension averages strictly exclude non-evaluated dimensions (`not_applicable` and `insufficient_evidence`) without penalizing them as zero.
    - Strongest-dimension safeguards: declaring a `strongestDimension` now requires at least two distinct evaluated dimensions (`validDimensions.length >= 2`) and a unique leading score without ties.
    - If evidence is insufficient or dimensions are tied, `strongestDimension` resolves to `null`.
    - UI displays a neutral fallback ("Insufficient comparative dimension evidence") without badge rather than claiming an unsubstantiated universal strength. When present, it is labeled as "Relative Strength".
-   **Dashboard Metric Definitions Clarification**:
    - Documented and validated that `totalCompleted` strictly counts interviews with completed reports (`overallScore: { not: null }`, `status: "completed"`), never sessions that merely ended or failed evaluation.
    - All existing migrations and database schema preserved without modification.

## Milestone 9 --- Cross-Session Personalization & Adaptive Interview Recommendations

Recorded on 2026-10-19:
-   **Prisma Schema & Versioned Migration**:
    - Introduced `PersonalizationProfile` model in `prisma/schema.prisma` with a 1-to-1 cascade relation to `User` (`userId @unique`).
    - Tracks `status`, `schemaVersion` ("1.0"), `consentGrantedAt`, `consentNoticeVersion`, `eligibleReportCount`, `eligibleReportIds` (JSON array), `compiledAt`, `lastRefreshedAt`, and structured `profileData` (JSON).
    - Executed version-controlled migration `20261019000000_personalization_profile` committed to Git.
-   **Strict Post-Consent Eligibility Boundary**:
    - Purpose-specific `personalization` consent is explicitly opt-in, disabled by default, and tracked in `user_consent` and immutable `consent_audit_log`.
    - Active grant timestamp is authoritatively derived from the latest `ConsentAuditLog` record (`purpose: "personalization"`, `action: "granted"`). Fails closed if missing or contradictory.
    - Post-consent window enforcement: Only completed interview reports completed *at or after* the active consent grant timestamp qualify as eligible evidence. Pre-consent sessions are strictly excluded from the personalization window per privacy policy.
    - Minimum evidence threshold: Exactly 3 eligible post-consent completed reports are required before cross-session recommendations can be unlocked. Guest sessions and candidates with fewer than 3 post-consent reports receive general guidance only.
-   **Deterministic Profile Compiler & Evidence Grounding**:
    - Implemented in `src/server/personalization/compiler.ts`. No LLM fine-tuning or vector databases.
    - Computes dimension aggregates strictly over scored evaluations; non-measured dimensions are never penalized as zero.
    - Recurring strengths require >= 2 observations with an average score >= 80.
    - Recurring improvement areas require >= 2 observations with an average score < 75. A single low score does not constitute a recurring pattern.
    - Recommendations provide concrete practice activities, measurable goals, rationale, and traceable supporting report IDs (`supportingReportIds`) linked directly to candidate reports (`/interview/[id]/report`).
    - Output is strictly validated through Zod schema (`personalizationProfileDataSchema`) before caching or presentation.
-   **Atomic Withdrawal & Profile Purge**:
    - In `src/server/consent/service.ts` (`withdrawConsent`), withdrawing `personalization` consent immediately executes `tx.personalizationProfile.deleteMany({ where: { userId } })` inside the database transaction.
    - Purges stored profiles immediately and logs revocation to `ConsentAuditLog`.
    - Resets the 3-session qualification window so subsequent opt-in requires 3 fresh post-reconsent interviews.
-   **In-Flight Pre-Commit Boundary**:
    - `getOrCompilePersonalizationProfile` re-checks consent against `ConsentAuditLog` immediately before committing an upsert to the database. If consent was revoked while compilation was in flight, persistence is aborted and unpersonalized guidance is returned.
-   **Settings & Dashboard UI Integration**:
    - Settings page (`src/app/(workspace)/settings/page.tsx`): Interactive consent management displaying authoritative status, post-consent calibration progress (N of 3 required simulations completed), clear privacy disclosures (transient audio, no video storage), and a confirmation modal with immediate purge notice for withdrawal.
    - Dashboard page (`src/app/(workspace)/dashboard/page.tsx`): Integrated `RecommendationWidget` (`src/components/dashboard/RecommendationWidget.tsx`) displaying:
      1. Adaptive recommendation with focus tags, practice activity, target goal, suggested setup, rationale, and clickable supporting report links when active.
      2. Calibration progress bar and truthful explanation ("N of 3 completed") when consent is active but fewer than 3 post-consent sessions exist.

## Milestone 10 --- Pre-Release Polish, End-to-End Verification & Security Hardening

Recorded on 2026-10-20:
-   **Security Headers & Attack Surface Reduction**:
    - Configured server-level security headers in `next.config.ts`: `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff` (MIME sniffing protection), `Referrer-Policy: strict-origin-when-cross-origin` (cross-origin referrer minimization), and restrictive `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`.
    - Private page indexing protection: added `robots: { index: false, follow: false }` metadata to `src/app/(workspace)/layout.tsx` and created `src/app/interview/layout.tsx` to prevent search engine web crawlers from indexing candidate dashboards, interview sessions, and private evaluation reports.
-   **End-to-End Candidate Journeys & Verification**:
    - Implemented dedicated E2E test suites in `src/test/e2e/` covering all five candidate journeys:
      1. **Journey A (Guest Candidate)**: Guest session generation, 24-hour expiration, 4 interview modes, text fallback answer capture, report generation, session isolation, and general guidance.
      2. **Journey B (Registered Candidate)**: Better Auth session resolution, sliding 7-day idle vs. 30-day absolute expiration cutoff, interview completion, dashboard metrics update, consistent page refreshes, and cross-user isolation.
      3. **Journey C (Interview Room Recovery)**: Mic permission denial & unsupported speech degradation, pause/resume elapsed timer calculation with accumulated pause duration, question skipping, safe exit, Realistic Mode locking against post-submission modifications, evaluation failure handling with usage quota release, and idempotent report retrieval.
      4. **Journey D (Consent and Personalization)**: Granular consent gating, strict 3-post-consent completed report threshold, candidate-scoped profiles, atomic withdrawal profile purge, and re-consent eligibility window reset.
      5. **Journey E (Evaluation and Reports)**: Rubric dimension weighting across all 4 modes, zero-penalty preservation for `not_applicable` and `insufficient_evidence`, strict Zod output validation, and rubric version freezing.
-   **Automated Quality & Verification Status**:
    - Vitest: 50 test files, 288 tests passed, 0 failures.
    - ESLint: 0 errors, 0 warnings across the entire codebase.
    - TypeScript: 0 typecheck errors (`tsc --noEmit`).
    - Prisma: schema validated, 6 version-controlled migrations committed.
    - Build: Next.js production build (`next build`) succeeded in Turbopack.

## Milestone 12 --- Live Integration Verification & Private Beta Readiness

Recorded on 2026-10-21:
-   **Neon Database Live Connectivity & Migrations**:
    - Verified connectivity to live Neon PostgreSQL compute endpoint across both pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connection strings.
    - Handled Neon serverless compute sleep/wake lifecycle: initial connection triggers compute activation, subsequent transactions execute with low latency.
    - Applied pending migration `20261019000000_personalization_profile` using `npx prisma migrate deploy` (zero destructive resets or db pushes).
    - Confirmed all 6 Prisma migrations applied in `_prisma_migrations` and all 15 public schema tables present.
-   **Environment & Secrets Hygiene**:
    - Confirmed `.env` and `.env.local` are strictly excluded from version control via `.gitignore`.
    - Sanitized `.env.example` with safe placeholder values (`replace-me`, `replace-with-a-long-random-secret`).
    - Confirmed zero server secrets (API keys, DB connection strings, auth secrets) are exposed to client-side bundles or `NEXT_PUBLIC_` variables.
-   **Live Integration Verification & Fallback Question Bank**:
    - Validated `GeminiProviderAdapter` credential resolution and error sanitization: when `GEMINI_API_KEY` is not present, the adapter fails closed with sanitized `AiProviderError`, preventing credential leaks or unhandled crashes.
    - Verified the Reviewed Fallback Question Bank (`BANK_VERSION = "1.0"`) across all 4 modes (Technical, Behavioral, Resume, Company) across Easy, Medium, and Hard difficulties.
    - Executed full live interview lifecycle smoke test in Neon PostgreSQL:
      1. Created synthetic guest session with explicit consents.
      2. Initialized interview with 3 questions; verified records persisted in `interview` and `interview_question` with source `'fallback'`.
      3. Started interview (`in_progress`), verified server-side timer calculations.
      4. Submitted text answers for all questions; verified persistence in `interview_answer`.
      5. Verified Realistic Mode locking: attempts to overwrite submitted answers are rejected with `InterviewAnswerLockedError`.
      6. Evaluation pipeline safely caught unconfigured AI key, released reserved quota, and updated report status to `'failed'` with clean failure reason, preserving submitted answers.
      7. Verified cross-user isolation: unauthorized guest/user access to room state and reports is blocked with 403 Forbidden.
      8. Cleaned up synthetic test records from the live Neon database.
-   **Verification Suite Results**:
    - Vitest: 50 test files, 288 tests passed (100% pass rate).
    - ESLint: 0 errors, 0 warnings across all files.
    - TypeScript: 0 errors (`tsc --noEmit`).
    - Prisma: schema valid (`prisma validate`).
    - Production build: `next build` succeeded with 14 static pages and optimized dynamic routes.

## Milestone 12.1 --- Gemini 3.5 Flash-Lite Migration & Live Interview Verification

Recorded on 2026-10-21:
-   **Model Migration to `gemini-3.5-flash-lite`**:
    - Migrated system-wide default Gemini model from legacy `gemini-2.0-flash` to verified production model `gemini-3.5-flash-lite`.
    - Maintained full configurability via `process.env.GEMINI_MODEL`, defaulting to `"gemini-3.5-flash-lite"`.
    - Updated mock adapter default to `"mock-gemini-3.5-flash-lite"` and updated all corresponding unit/integration test assertions, schema comments, and `.env.example`.
-   **Gemini Adapter Latency & Schema Resilience**:
    - Increased `DEFAULT_TIMEOUT_MS` in `src/server/ai/gemini-adapter.ts` from 15,000ms to 60,000ms (with `GEMINI_TIMEOUT_MS` override support) to comfortably support `gemini-3.5-flash-lite`'s ~20-30s structured JSON generation latency.
    - Added an explicit JSON `SCHEMA` specification block to `EVALUATION_SYSTEM_PROMPT` in `src/server/evaluation/prompts.ts` instructing the model to output exact camelCase keys.
    - Added defensive key normalization in `src/server/evaluation/schemas.ts` (`normalizeRawEvaluation`) to gracefully normalize model key variations (e.g., `executive_summary` -> `summary`, `dimensions` -> `dimensionScores`, `key_strengths` -> `strengths`, `key_improvements` -> `improvements`) prior to strict Zod schema validation.
-   **Live Gemini 3.5 Connectivity & End-to-End Interview Verification**:
    - Live Gemini API connectivity verified: question generation returned 3 structured questions with token tracking (Prompt=326, Completion=218, Total=544).
    - Executed live end-to-end interview smoke test in Neon PostgreSQL:
      1. Created synthetic guest session with explicit consents.
      2. Initialized interview; persisted 3 live Gemini questions to `interview` and `interview_question` with `source: 'gemini'`, `model: 'gemini-3.5-flash-lite'`.
      3. Started interview (`in_progress`) and submitted 3 candidate answers to `interview_answer`.
      4. Verified Realistic Mode locking: locked answers reject post-submission edits.
      5. Executed live Gemini evaluation pipeline: persisted report with `status: 'completed'`, `overallScore: 48/100`, executive summary, recommendation, and 6 dimension scores.
      6. Verified idempotent retry: re-evaluating the completed interview returned the cached report without redundant model invocation.
      7. Verified usage quota accounting: confirmed 2 committed `usage_record` rows in Neon DB (question generation: 526 tokens; evaluation: 2,718 tokens).
      8. Verified cross-user isolation: unauthorized guest/user access rejected with 403 Forbidden.
      9. Cleaned up synthetic records from Neon database.
-   **Verification Suite Results**:
    - Vitest: 50 test files, 288 tests passed (100% pass rate).
    - ESLint: 0 errors, 0 warnings.
    - TypeScript: 0 errors (`tsc --noEmit`).
    - Prisma: schema valid (`prisma validate`).
    - Production build: `next build` succeeded in Turbopack.

## Milestone 13 --- Secure Staging Deployment & Hosted Application Verification

Recorded on 2026-10-21:
-   **Serverless Function Runtime Duration (`maxDuration = 60`)**:
    - Configured explicit `export const maxDuration = 60;` in the two long-running AI endpoints:
      1. `src/app/api/interviews/route.ts` (question generation)
      2. `src/app/api/interviews/[id]/report/route.ts` (evaluation and scoring)
    - **Rationale**: On Vercel, unconfigured Serverless Functions default to 15 seconds (Hobby default was 10s–15s). Because `gemini-3.5-flash-lite` evaluation calls take 20–35 seconds for full rubric grading and JSON synthesis, requests would fail with `504 FUNCTION_INVOCATION_TIMEOUT` without an explicit duration override.
    - Setting `maxDuration = 60` configures the runtime timeout to 60 seconds, which is supported on both Hobby (maximum allowed limit) and Pro plans without exceeding free-tier or plan constraints.
-   **Build Script Prisma Generation**:
    - Updated `package.json` build script from `"next build"` to `"prisma generate && next build"`.
    - Guarantees that the Prisma Client engine binary and TypeScript definitions are compiled for the deployment container architecture prior to Next.js compilation.


