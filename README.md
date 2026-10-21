# AI Interview Simulator

## Project status

Planning and architecture decisions are complete through Phase 3. Phase
4 consolidates those decisions into a baseline for implementation. This
repository is intended to be built in small, verified milestones; do not
implement the entire product in one large change.

## Product

An AI-powered interview practice platform for college students preparing
for internships and campus placements. Students configure an interview,
answer questions through voice or text, and receive evidence-based
feedback and progress insights.

## MVP principles

-   Free-tier-first, but never promise zero cost or commercial
    eligibility until current provider terms and quotas are verified.
-   Privacy-first: no permanent audio/video recordings and no visual AI
    scoring in the MVP.
-   Server-side authorization, consent checks, quotas, and lifecycle
    validation.
-   Structured AI outputs must be schema-validated before use.
-   AI scores are estimates of interview performance, not measures of
    intelligence, personality, or employability.
-   Build foundation first, then complete vertical feature slices.

## Planned documentation

-   `PRODUCT_SPEC.md`: product requirements and acceptance criteria.
-   `ARCHITECTURE.md`: stack, modules, data flow, and system boundaries.
-   `DECISIONS.md`: decisions and rationale.
-   `SECURITY_PRIVACY.md`: privacy, security, consent, and retention.
-   `TESTING_RELEASE.md`: testing strategy, environments, and release
    gates.
-   `AGENTS.md`: coding-agent operating rules.
-   `.env.example`: environment variable names with safe placeholders
    only.

## Intended stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React,
Motion, Neon PostgreSQL, Prisma, Better Auth, Google Gemini API, Vercel,
GitHub, Resend, Mozilla PDF.js, and a managed background-job service
such as Inngest pending compatibility and quota verification.

## Before implementation

Verify current provider free-tier limits, commercial terms,
data-handling terms, regional availability, background-job constraints,
and applicable legal requirements. Record findings and dates in
`DECISIONS.md`.

## Local setup

### Prerequisites

- Node.js >= 20 (verified on Node v25.7.0)
- npm >= 10 (verified on npm 11.10.1)

### Installation

1. Clone repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure local environment:
   ```bash
   cp .env.example .env.local
   cp .env.local .env
   ```
   *Note: Never commit real credentials, .env, or .env.local to version control.*
   *Prisma CLI reads `.env` directly from the repository root on Windows, while Next.js loads `.env.local`.*

### Authentication & Service Configuration Status

| Service / Provider | Purpose | Status in Milestone 10 | Required Action Before Live Beta |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (Neon)** | Database & Session persistence | **Active** (Prisma migrations applied) | Maintain Neon connection strings in staging/production `.env`. |
| **Better Auth** | Authentication & Session Management | **Active** (7-day idle, 30-day absolute timeout) | Set high-entropy `BETTER_AUTH_SECRET` (min 32 chars) in production. |
| **Google Sign-In** | Social OAuth login | **Configured (Optional)** | Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console. |
| **Google Gemini API** | AI question & evaluation adapter | **Integrated** (Adapter + reviewed fallback bank) | Set `GEMINI_API_KEY` and verify current `GEMINI_MODEL` before live traffic. |
| **Resend** | Transactional email delivery | **Mockable / Unverified Live** | Configure verified sending domain & `RESEND_API_KEY` before public launch. |
| **Inngest** | Background durable jobs | **Deferred** (Synchronous transactional pipeline active) | Optional for beta; synchronous durable pipeline active. |
| **Cloudflare Turnstile** | Anti-bot auth challenge | **Configured (Optional)** | Requires `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. |


### Available scripts

- `npm run dev`: Launch the Next.js App Router local development server
- `npm run build`: Create an optimized production build
- `npm run start`: Start the production server locally
- `npm run lint`: Run ESLint checks across the codebase
- `npm run typecheck`: Run TypeScript type checking (`tsc --noEmit`)
- `npm run test`: Run the test suite with Vitest
- `npm run test:watch`: Run the test suite in watch mode
- `npm run db:generate`: Generate the typed Prisma Client
- `npm run db:validate`: Validate the Prisma schema
- `npm run db:migrate:dev`: Apply migrations in development environment
- `npm run db:migrate:deploy`: Apply migrations safely in staging/production

### Repository structure

```text
├── prisma/
│   ├── schema.prisma   # PostgreSQL schema with Better Auth, Consent, & Interview models
│   └── migrations/     # Version-controlled SQL migrations (0_init)
├── src/
│   ├── app/            # Next.js App Router routes & layout
│   ├── components/     # Reusable shared UI primitives & shell components
│   ├── lib/            # Environment validation & shared utilities
│   ├── server/         # Modular monolith server boundaries & Prisma singleton
│   └── test/           # Test configuration & setup helpers
├── .env.example        # Documented environment variables with placeholders
├── AGENTS.md           # Coding agent operating rules
├── ARCHITECTURE.md     # System boundaries & modular monolith architecture
├── DECISIONS.md        # Architecture & product decisions record
├── IMPLEMENTATION_ROADMAP.md # Sequential implementation milestones
├── PRODUCT_SPEC.md     # Product specifications & acceptance criteria
├── SECURITY_PRIVACY.md # Security baseline, retention & consent policies
├── TESTING_RELEASE.md  # Verification gates & release criteria
└── UI_UX_SPEC.md       # UI design tokens, Inter font & layout standards
```

