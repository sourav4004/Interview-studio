# Architecture

## 1. Architecture style

Full-stack Next.js modular monolith. Keep one deployable application
with clear internal modules; do not split into microservices for the
MVP.

## 2. Stack baseline

-   Next.js + React + TypeScript
-   Tailwind CSS + shadcn/ui + Lucide React + Motion
-   Neon PostgreSQL
-   Prisma ORM
-   Better Auth
-   Google Gemini API behind an internal provider adapter
-   Mozilla PDF.js for server-side PDF text extraction
-   Resend for transactional email
-   Inngest preferred candidate for durable background jobs, pending
    current compatibility/quota verification
-   Vercel hosting; GitHub source control and CI/CD
-   React Hook Form + Zod for forms and validation
-   Figma for wireframes and visual design

## 3. Suggested module boundaries

-   `auth`: identity, sessions, account linking, verification and
    recovery
-   `users`: profile, preferences, account settings
-   `consent`: purpose-specific consent state, notice versions,
    withdrawal
-   `interviews`: setup, lifecycle, questions, answers,
    pause/resume/exit
-   `question-bank`: reviewed fallback questions, tags, versions
-   `ai`: Gemini adapter, prompt versions, structured output validation,
    token accounting
-   `evaluation`: rubric versions, scoring, evidence and report assembly
-   `reports`: ownership, persistence, print-friendly view
-   `personalization`: opt-in profile, eligible evidence selection,
    recommendations
-   `resumes`: upload validation, extraction, redaction, optional saved
    resume
-   `usage`: quota reservations, idempotency and accounting
-   `jobs`: durable evaluation work, retry and stale-job recovery
-   `email`: templates, preferences, verified webhooks and delivery
    state
-   `privacy`: export, deletion, retention and cleanup workflows
-   `analytics`: minimal product events, privacy-conscious progress
    metrics
-   `observability`: safe logs, health checks and issue diagnostics

These are logical boundaries, not a requirement to create a file for
every noun immediately. Keep early structure simple and extract modules
as their responsibilities become real.

## 4. Request flow

1.  Route Handler authenticates the request and validates input.
2.  Server module checks authorization, consent, lifecycle state, and
    quota.
3.  Database transaction reserves usage or records a state transition as
    needed.
4.  AI adapter makes the provider request with minimal eligible/redacted
    content.
5.  Response is parsed and validated against a Zod schema.
6.  The server rechecks authorization/consent at persistence boundaries.
7.  Data and status are saved transactionally where possible.
8.  Client receives a minimal response and renders truthful state.

## 5. Database and state

PostgreSQL is the source of truth for users, interviews, answers,
question metadata, consent, usage, jobs/status, reports, preferences,
and deletion operations. Use transactions and constraints for critical
state changes. Keep timestamps in UTC. Enforce explicit lifecycle
transitions server-side.

Use Neon pooled connection configuration for app traffic and direct
connection configuration for migrations when required by provider
guidance. Verify current Neon/Prisma recommendations before
implementation.

## 6. AI provider boundary

All model calls go through a replaceable internal adapter. Keep provider
keys server-side. Use versioned prompts/rubrics and structured JSON
schemas. Validate output; never trust model output for authorization,
consent, quotas, or state transitions. Record model/prompt/rubric
versions and minimal token/latency metadata, not raw payloads.

## 7. Background jobs

Use a managed durable-job service only after verifying its current free
tier, duration limits, retry behavior, and Vercel compatibility.
PostgreSQL remains the source of truth. Jobs must be idempotent, recheck
consent, and recover stale states. A job provider failure must not erase
saved answers or create a false completed report.

## 8. Resume handling

Validate actual file format and limits server-side: PDF up to 4 MB and
20 pages. Extract text with PDF.js, cap normalized text at 20,000
characters, and offer pasted-text fallback. Best-effort redact
unnecessary direct identifiers before Gemini processing. Discard
original PDF after extraction. Temporary extracted text is deleted after
report finalization; failed evaluation may retain minimal temporary data
for up to 24 hours after terminal failure. Saved resume storage requires
separate explicit consent.

## 9. Deployment environments

-   Development: local development database and test credentials
-   Preview/staging: isolated database and credentials; never use real
    user data
-   Production: restricted credentials, HTTPS, production migrations via
    controlled `prisma migrate deploy` step Never use `prisma db push`
    in production. Use backward-compatible migrations and controlled
    rollback plans.

## 10. Observability

Use platform logs plus structured app logs. Never log full resumes,
transcripts, answers, scores, prompts, raw AI payloads, credentials,
tokens, or email contents. Initial targets: operational logs 30 days;
issue diagnostics up to 90 days only when needed and privacy-safe;
minimal email delivery records 30 days; minimal deletion audit records
30 days.

## 11. External verification

Before coding, verify current provider limits, terms, data use, regions,
job execution constraints, and commercial eligibility. Document dated
evidence rather than assuming free-tier availability is permanent.
