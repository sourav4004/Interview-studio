# Testing and Release Plan

## Testing layers

1.  Unit tests: validation, scoring helpers, state transitions, consent
    eligibility, quota logic.
2.  Integration tests: database transactions, authentication, ownership
    checks, provider adapters, job idempotency, deletion.
3.  End-to-end tests: registration, guest flow, setup, interview,
    report, history, consent withdrawal, export, deletion.
4.  AI evaluation benchmarks: fixed test set, rubric/version tracking,
    factual correctness, evidence attribution, uncertainty handling,
    prompt-injection resistance.
5.  Security/privacy tests: IDOR/ownership, auth enumeration,
    CSRF/origin, rate limits, consent races, prompt injection, secrets
    in logs, deletion behavior.
6.  Accessibility tests: keyboard, screen readers, contrast, focus
    management, error announcements; target WCAG 2.2 AA.
7.  Performance tests: Core Web Vitals target LCP ≤2.5s, INP ≤200ms, CLS
    ≤0.1 where measurable.
8.  Manual smoke tests before every release.

## Critical scenarios

-   Camera denied, mic denied, speech recognition unsupported/fails.
-   User stops speaking but answer must not auto-submit.
-   Duplicate submit, double-click, refresh, reconnect, pause/resume,
    timer expiry.
-   Question generation fails; only complete validated fallback set may
    be used.
-   Evaluation fails after answers are saved; report must not falsely
    show complete.
-   Consent withdrawn while a request/job is in flight.
-   Consent restored; old interviews must not enter rebuilt
    personalization profile.
-   Deleted interview no longer contributes to personal analytics.
-   Report accessed by another account must be denied.
-   Guest report transfer requires verified account and explicit
    consent.
-   Email/webhook duplicates and out-of-order events are handled
    idempotently.
-   Production migration tested against a representative database
    snapshot without real user data in preview.
-   Restore drill verifies backups and reapplication of deletion
    records.

## Release environments

-   Development: local DB and test secrets.
-   Preview/staging: separate DB and credentials; synthetic data only.
-   Production: restricted secrets, HTTPS, controlled migrations and
    rollback plan.

## CI/CD gates

-   Type checking, lint, unit/integration tests, build, dependency
    audit, secret scanning where available.
-   Migration validation.
-   E2E smoke test in staging.
-   No unresolved critical/high security or privacy findings.
-   Backward-compatible schema changes and controlled rollback.

## Provisional private-beta goals

-   ≥95% successful valid interview attempts.
-   100% of completed reports are validated and persisted.
-   All four modes pass benchmark tests.
-   ≥80% of testers complete the core journey.
-   Zero unresolved critical/high security or privacy issues.

These are provisional targets to review after beta instrumentation and
real usage.

## Milestone 10 Verification Suite & Release Readiness

Executed on 2026-10-20:
-   **Unit & Integration Tests (`npx vitest run`)**: 50 test files, 288 tests passed, 0 failures.
-   **End-to-End Candidate Journeys (`src/test/e2e/`)**:
    - `journey-a-guest.test.ts`: Guest session lifecycle, mode configs, text fallback, isolation, general guidance.
    - `journey-b-registered.test.ts`: Auth verification, 7-day idle vs. 30-day absolute expiration, report viewing, metrics update, user isolation.
    - `journey-c-recovery.test.ts`: Mic permission denial & unsupported speech, pause/resume, skip, exit, realistic locks, evaluation failure recovery with quota release, idempotency.
    - `journey-d-consent-personalization.test.ts`: Default off, 3-report threshold, candidate scoping, immediate withdrawal profile purge, re-consent eligibility reset.
    - `journey-e-evaluation-reports.test.ts`: 4 modes, skipped/insufficient answers, zero-penalty logic, schema validation, rubric version freezing.
-   **Static Analysis & Type Safety**:
    - `npm run lint`: 0 ESLint errors, 0 warnings.
    - `npm run typecheck`: 0 TypeScript compiler errors.
-   **Database & Migration Safety**:
    - `npm run db:validate`: Prisma schema valid.
    - 6 version-controlled migrations deployed via `prisma migrate deploy`.
-   **Production Build**:
    - `npm run build`: Production bundle compiled cleanly in Next.js Turbopack across all 20 App Router routes.

## Milestone 12 & 12.1 Live Integration & Smoke Test Verification

Executed on 2026-10-21:
-   **Model Configuration & Migration**:
    - Default Gemini model migrated to `gemini-3.5-flash-lite`, configurable via `GEMINI_MODEL`.
    - Adapter timeout expanded to 60,000ms (`DEFAULT_TIMEOUT_MS = 60000`, with `GEMINI_TIMEOUT_MS` override support).
    - Structured evaluation prompt supplemented with explicit `SCHEMA` definition block and defensive schema key normalization (`normalizeRawEvaluation`).
-   **Live Neon PostgreSQL Verification**:
    - Verified connectivity to live Neon compute endpoint with SSL.
    - All 6 Prisma migrations verified applied (`_prisma_migrations`).
    - All 15 public tables verified active and queryable.
-   **Reviewed Fallback Question Bank**:
    - Verified all 4 modes (Technical, Behavioral, Resume, Company) across difficulty tiers.
-   **Live Gemini 3.5 API Verification**:
    - Question generation: 3 structured React questions generated via `gemini-3.5-flash-lite` (544 tokens total).
    - Evaluation generation: structured evaluation scored against rubrics with 6 dimension breakdown (2,204 tokens total).
-   **Live End-to-End Interview Lifecycle Smoke Test**:
    - Synthetic guest session created with explicit consents.
    - Interview initialized with 3 live Gemini questions and persisted to database.
    - Realistic Mode locks confirmed answers against post-submission modification.
    - Full evaluation report generated, scored, and persisted (`status: 'completed'`).
    - Idempotent report retrieval confirmed: secondary requests return cached evaluation without double billing.
    - Database usage quota accounting confirmed: 2 committed `usage_record` rows.
    - Cross-user isolation verified: 403 Forbidden on cross-user session and report endpoints.
    - Synthetic test data cleanly purged from database.
-   **Verification Gate Summary**:
    - Vitest: 50 test files, 288 passed, 0 failed.
    - ESLint: 0 errors, 0 warnings.
    - TypeScript: 0 errors (`tsc --noEmit`).
    - Prisma: schema valid (`prisma validate`).
    - Next.js Build: 0 errors, static & dynamic routes compiled cleanly.


