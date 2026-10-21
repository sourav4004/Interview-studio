# Instructions for AI Coding Agents

## Role

Act as a careful senior engineer implementing an already planned
product. Preserve architecture, privacy, security, and product
decisions. Do not silently invent or change requirements.

## Required workflow

For every task: 1. Inspect relevant files and existing patterns. 2.
Summarize the plan and acceptance criteria. 3. Implement the smallest
complete change. 4. Run relevant tests, type checks, lint, and build
checks. 5. Report changed files, commands run, outcomes, and remaining
risks. 6. Commit only after verification when the user/workflow
authorizes commits.

## Scope discipline

-   Do not build the entire application in one change.
-   Do not add dependencies without explaining why and checking
    maintenance/security.
-   Do not split into microservices for the MVP.
-   Do not replace selected stack components without explicit approval.
-   Prefer vertical feature slices after a small foundation.
-   Preserve existing behavior unless a requirement explicitly changes
    it.

## Security and privacy

-   Server-side authorization for every private resource.
-   Validate input and AI output with Zod or an equivalent established
    schema.
-   Never expose provider secrets in client bundles or `NEXT_PUBLIC_`
    variables.
-   Never log passwords, tokens, raw AI payloads, resumes, transcripts,
    answers, or email contents.
-   Check consent at request, job, retry, and persistence boundaries.
-   Never use model output to authorize access, change quotas, or bypass
    application policy.
-   No permanent audio/video recordings and no visual AI scoring in MVP.
-   Use idempotency for quotas, report generation, deletion,
    email/webhooks, and background jobs.
-   Do not claim success until the operation has actually succeeded and
    persisted.

## Database and deployment

-   Use Prisma migrations committed to Git.
-   Production migrations use a controlled `prisma migrate deploy` step.
-   Never use `prisma db push` in production.
-   Keep dev, preview/staging, and production credentials/databases
    separate.
-   Never use real user data in previews.
-   Use transactions/constraints for critical state changes.

## AI behavior

-   Route model calls through a replaceable server-side adapter.
-   Version prompts and rubrics.
-   Use structured output and strict validation.
-   Preserve evidence and uncertainty; never fabricate credentials,
    projects, answers, or facts.
-   Respect token/usage budgets and bounded retries.
-   Do not automatically add a second AI provider in MVP.

## UI/UX

-   Follow the approved indigo/violet palette and Inter font direction;
    verify contrast.
-   Responsive, keyboard-accessible, clear loading/error/empty states.
-   Do not use fake progress percentages or fake countdowns.
-   Never automatically activate microphone/camera or submit answers.
-   Provide text fallbacks where possible.

## Repository and handoff

-   Keep `README.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`,
    `DECISIONS.md`, `SECURITY_PRIVACY.md`, and `TESTING_RELEASE.md`
    synchronized with material changes.
-   Record architecture changes and rationale in `DECISIONS.md`.
-   Keep `.env.example` updated with variable names and safe
    placeholders only.
-   When switching AI tools, rely on repository docs and Git history,
    not hidden conversation assumptions.

## Completion report

At the end of each task, report: - Summary - Files changed -
Tests/checks run and results - Known limitations - Next smallest task
