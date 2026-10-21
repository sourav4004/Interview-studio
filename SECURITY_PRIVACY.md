# Security and Privacy Baseline

## Principles

-   Data minimization, purpose limitation, transparency, explicit
    consent, least privilege, safe defaults.
-   Server-side authorization and validation; never rely on
    frontend-only controls.
-   No permanent audio/video recordings and no visual AI scoring in MVP.
-   No secrets or raw AI payloads in logs.
-   Do not claim provider-side deletion, zero retention, or India-only
    data residency unless verified.

## Consent purposes

1.  Generate interview questions from relevant supplied information.
2.  Evaluate answers and generate reports.
3.  Process resume content for the current interview.
4.  Store a resume for future interviews.
5.  Use permitted historical interview data for personalization.

Purposes 1 and 2 may be presented together if both are required, but
explain both. Purpose 3 never implies purpose 4. Historical-data
personalization is distinct from retaining history for the student's own
access. Optional purposes are off by default.

## Consent enforcement

-   Record grant/withdrawal action, timestamp, notice version, and
    purpose.
-   Current consent state is authoritative; historical records do not
    authorize processing.
-   Check consent at request start, queue execution, retries, and
    persistence.
-   Withdrawal blocks future processing immediately and cancels pending
    work where safe.
-   Persist only validated results eligible under the policy; discard
    uncommitted responses arriving after withdrawal.
-   Material changes to provider, purpose, data category, or handling
    require renewed consent.
-   If consent service is unavailable, fail closed for affected AI
    processing.

## Authentication and sessions

-   Better Auth, pending capability verification.
-   Secure, HttpOnly, SameSite=Lax cookies; HTTPS in production.
-   Idle timeout 7 days; absolute lifetime 30 days; maximum 5 active
    sessions.
-   Only meaningful user activity resets idle timer; background polling
    does not.
-   Current-device logout and log out all devices.
-   Password reset: 30-minute single-use token; successful reset revokes
    app sessions and requires fresh sign-in.
-   Email verification link: 24 hours; resend cooldown 60 seconds;
    unverified email/password accounts deleted after 7 days.
-   Recent authentication required for sensitive account changes and
    deletion.
-   Account linking is explicit and authenticated; never merge accounts
    on email match alone.
-   Generic public auth responses and distributed rate limits; no
    permanent fixed lockouts.
-   New-login alerts optional; security-change notifications remain
    enabled.
-   No MFA in MVP; document this limitation.
-   Guest sessions: Opaque 32-byte cryptographically secure random token generated on server; client receives raw token once; server persists ONLY deterministic SHA-256 hash (`tokenHash`). Never store plaintext guest tokens. 24-hour expiration (`GUEST_SESSION_DURATION_MS`). Server-side ownership checks (`assertGuestOwnership`, `assertResourceAccess`) required for guest-scoped resources.

## Upload and prompt-injection safety

-   PDF max 4 MB and 20 pages, server-validated actual format.
-   Resume text max 20,000 chars; combined optional context max 10,000
    chars.
-   Reject malformed/encrypted/unsupported files safely.
-   Best-effort redaction of unnecessary direct identifiers before
    sending resume/transcript to Gemini.
-   Treat uploaded content, job descriptions, transcripts, and retrieved
    text as untrusted data.
-   Separate system instructions from user content; strict schemas and
    bounded model behavior.
-   Model output must never control authorization, quota, consent, or
    state transitions.
-   No secrets in prompts.

## Data retention and deletion

-   Original resume PDF discarded after extraction.
-   Temporary extracted resume text deleted after successful report
    finalization; terminal evaluation failure recovery data up to 24
    hours.
-   Saved resume requires explicit opt-in. One active saved resume per
    account.
-   Withdrawing saved-resume storage consent deletes saved resume,
    reusable extracted copies/caches, and resume-derived evidence
    excerpts from historical reports; preserve scores/feedback where
    possible and label evidence unavailable.
-   Historical personalization consent requires opt-in; the evidence window strictly excludes sessions completed prior to the active consent grant timestamp. Exactly 3 post-consent completed simulations are required before compiling or serving cross-session recommendations.
-   Historical personalization withdrawal immediately purges the `personalization_profile` record in the database transaction, writes an immutable revocation entry to `consent_audit_log`, and resets the 3-session eligibility window for any future opt-in.
-   Individual interview deletion removes report, transcript, answers,
    excerpts, interview analytics and personal progress contribution
    where applicable.
-   Account deletion immediately revokes access, then performs retryable
    active-system cleanup.
-   Backup copies may remain until documented expiration; restored
    backups must reapply deletion records before user access.
-   Keep minimal deletion-operation metadata up to 30 days.
-   Operational logs target 30 days; issue diagnostics up to 90 days
    only where needed and privacy-safe; email delivery records 30 days.
-   No email-open tracking in MVP.

## Web security

-   CSP report-only in development/preview; investigate violations;
    enforce in production after tests.
-   HSTS one year only after HTTPS is confirmed; no
    preload/includeSubDomains without separate review.
-   `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`, CSP frame
    restrictions (`X-Frame-Options: DENY`), and restrictive Permissions-Policy
    (`camera=(self), microphone=(self), geolocation=()`) configured in `next.config.ts`.
-   Private-page crawler exclusion: `robots: { index: false, follow: false }`
    exported across `src/app/(workspace)/layout.tsx` and `src/app/interview/layout.tsx`.
-   Use Better Auth/framework CSRF protections plus origin validation as
    appropriate; avoid conflicting duplicate controls.
-   Validate redirects and prevent open redirects.
-   No tokens in localStorage.

## Incident response

Maintain a documented checklist: contain affected systems, revoke
compromised credentials, preserve minimal safe evidence, assess data
impact, restore service safely, determine applicable notification
duties, communicate accurately, and record remediation. Legal
notification timelines must be verified for applicable jurisdictions.
