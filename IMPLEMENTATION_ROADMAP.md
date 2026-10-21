# Implementation Roadmap

## Working rules

Use Inspect → Plan → Implement → Verify. Each milestone should be
independently testable and committed after verification. Do not build
the entire app in one prompt. Keep implementation sequential unless
parallel work has clear boundaries and no shared-file conflicts.

## Milestone 0 --- External constraints and repository decisions

-   Verify current provider terms, free-tier quotas, regions, and
    data-handling practices.
-   Verify Better Auth and background-job requirements.
-   Confirm supported Node.js/package-manager versions and pin
    dependencies.
-   Record verified facts and dates in `DECISIONS.md`. **Exit
    criteria:** No critical provider assumption remains unverified for
    the foundation.

## Milestone 1 --- Repository foundation

-   Initialize Next.js + TypeScript project.
-   Add lint, typecheck, test, and build scripts.
-   Add environment validation and safe `.env.example`.
-   Establish module boundaries and error handling.
-   Add CI checks and secure default headers in report-only CSP mode.
    **Exit criteria:** Clean install, lint, typecheck, tests, and
    production build pass.

## Milestone 2 --- Design system and application shell

-   Define tokens, typography, spacing, buttons, inputs, cards, dialogs,
    toasts, loading/empty/error states.
-   Build public layout and responsive dashboard shell.
-   Add accessibility baseline and reduced-motion support. **Exit
    criteria:** Page shell works on desktop/mobile and passes basic
    keyboard/contrast checks.

## Milestone 3 --- Database and authentication

-   Configure Neon, Prisma schema, controlled migrations.
-   Implement Better Auth and verified email/Google sign-in as
    supported.
-   Add secure sessions, settings, current-device logout, log out all
    devices.
-   Add guest-session primitives and account ownership tests. **Exit
    criteria:** Auth journeys and access-control tests pass in isolated
    development/staging environments.

## Milestone 4 --- Consent, privacy, and usage foundation

-   Purpose-specific consent records and server enforcement.
-   Guest expiry, quota reservations, idempotency.
-   Export/deletion workflow primitives and retention jobs.
-   Privacy-safe structured logs. **Exit criteria:** Consent race,
    withdrawal, quota duplication, and ownership tests pass before AI
    features are added.

## Milestone 5 --- Interview setup and question generation

-   Build wizard and server validation.
-   Implement provider adapter, prompt/rubric versioning, structured
    output schemas.
-   Add reviewed fallback bank and source labeling.
-   Implement usage reservation and safe failure handling. **Exit
    criteria:** All four modes can produce a complete validated question
    set or stop safely; failed starts do not consume allowance.

## Milestone 6 --- Interview room

-   Implement lifecycle state machine and answer persistence.
-   Add avatar states, browser speech, transcript review, explicit
    confirmation, text fallback.
-   Add pause/resume, skip, replay, timer-expiry, and recovery behavior.
    **Exit criteria:** No auto-submit, duplicate answer writes, false
    completion, or privacy-policy violations in E2E tests.

## Milestone 7 --- Evaluation and reports

-   Implement rubric-based evaluation and evidence validation.
-   Add background jobs if provider verification supports them;
    otherwise keep a safe bounded request strategy until jobs are ready.
-   Persist validated reports and truthful status.
-   Build report UI and print layout. **Exit criteria:** Benchmark,
    retry/idempotency, and report-persistence tests pass.

## Milestone 8 --- Dashboard and history

-   Recent interview list, comparable score trend, report links, empty
    states.
-   Guest report transfer with verification and explicit consent. **Exit
    criteria:** Ownership, transfer, and incomplete-history tests pass.

## Milestone 9 --- Resume and company context

-   PDF extraction, limits, redaction, pasted-text fallback.
-   Saved resume opt-in and deletion rules.
-   Company/context source labels. **Exit criteria:** Upload validation,
    data minimization, consent, and deletion tests pass.

## Milestone 10 --- Personalization

-   General recommendations first.
-   Implement opt-in historical personalization, three-interview
    threshold, post-renewal eligibility boundary, profile deletion on
    withdrawal, stale refresh logic. **Exit criteria:** Consent and
    deleted-data tests prove pre-consent data cannot rebuild the
    profile.

## Milestone 11 --- Email, exports, and account lifecycle hardening

-   Verification, reset, security notifications, optional report-ready
    emails.
-   Verified webhooks and delivery state.
-   Data export, individual interview deletion, account deletion. **Exit
    criteria:** Email failure never blocks report access; deletion is
    idempotent and observable.

## Milestone 12 --- Beta hardening and release

-   Security/privacy review, accessibility review, performance testing,
    AI benchmarks.
-   Backups and restore drill, monitoring, incident-response checklist.
-   Private beta, issue triage, and measured iteration. **Exit
    criteria:** No unresolved critical/high security/privacy issues;
    release smoke tests pass; provisional beta targets reviewed.

## Scope guardrails

-   No microservices for MVP.
-   No real-time 3D avatar.
-   No visual AI scoring.
-   No permanent audio/video recording.
-   No OCR until there is demonstrated need.
-   No second AI provider fallback until cost, reliability, and privacy
    are assessed.
-   Do not add new major features during foundation work without
    updating the spec and acceptance criteria.
