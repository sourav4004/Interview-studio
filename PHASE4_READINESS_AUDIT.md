# Phase 4 Readiness and Consistency Audit

## Status

Planning baseline consolidated. This audit records the key cross-policy
checks that must be preserved during implementation. External provider
terms and applicable legal obligations still require current
verification.

## Consistent policy boundaries

1.  **History vs personalization:** Retaining completed reports for the
    student's own access does not grant permission to use them for
    historical-data personalization.
2.  **Consent withdrawal:** Current consent governs new processing.
    Pending jobs and retries must recheck consent; app-controlled data
    cannot be recreated from deleted profiles.
3.  **Renewed personalization consent:** Start with an empty profile and
    use only eligible interviews completed after renewed consent. At
    least three eligible interviews plus evidence-quality checks are
    required.
4.  **Saved resume vs current processing:** Permission to process a
    resume for one interview does not authorize persistent resume
    storage.
5.  **Resume evidence deletion:** On saved-resume storage consent
    withdrawal, delete saved resume and reusable copies, and remove
    resume-derived evidence excerpts from historical reports where
    app-controlled. Preserve scores and feedback where possible, marking
    evidence unavailable.
6.  **Reports vs recordings:** Save transcripts, answers, scores and
    feedback according to retention rules; do not permanently store
    audio/video recordings. The MVP performs no visual AI scoring.
7.  **AI success vs report completion:** A provider response is not a
    completed report until output is schema-validated and durably
    persisted.
8.  **Quota accounting:** Reserve usage idempotently; failed interview
    generation before a valid start does not consume an interview
    allowance. A resumed interview reuses its original reservation.
9.  **Fallback question sets:** Use only complete, validated fallback
    sets. Label the source before start and again in the report. Do not
    combine incomparable scores blindly.
10. **Guest vs registered data:** Guest reports are temporary and
    accessible only while the guest session remains valid. Transfer
    requires verification and explicit consent.
11. **Deletion vs backups:** Revoke access immediately and delete
    app-controlled active data through retryable workflows. Backup
    expiration and external-provider deletion must be described
    accurately.
12. **Email vs report access:** Email failure must never block report
    access. Emails contain no scores or answers; report links require
    normal authentication and ownership checks.
13. **Personalization failure:** Keep prior successful recommendations
    with their original timestamp. Use general guidance when no eligible
    recommendations exist.
14. **Security vs UI:** UI controls are not authorization. Every private
    operation is checked server-side.
15. **Deployment:** Preview environments use separate
    credentials/databases and synthetic data only. Production migrations
    use controlled deployment, never `db push`.

## Implementation risks to resolve with evidence

-   Verify Better Auth supports the chosen account, verification,
    session, reauthentication, and provider-linking behavior before
    relying on it.
-   Verify current Gemini API model availability, quotas, data-use
    terms, pricing, and structured-output capabilities.
-   Verify Vercel plan terms, background-job execution compatibility,
    and long-running evaluation constraints.
-   Verify Neon pooling, migration connectivity, backups, PITR, and
    regional options.
-   Verify Resend sending/domain/webhook limits and event behavior.
-   Verify Inngest free-tier limits, retry/duration constraints, and
    integration compatibility.
-   Verify current Indian and other applicable privacy, consumer,
    accessibility, and AI-related legal obligations.

## Contradictions to avoid

-   Never say "all data is deleted immediately" when backups or provider
    retention may remain.
-   Never claim the avatar's visual behavior measures confidence or
    personality.
-   Never let restored consent authorize pre-consent interviews for
    rebuilding personalization.
-   Never count skipped/unanswered questions as incorrect answers.
-   Never label an AI-generated or fallback report complete before
    validation and persistence.
-   Never use model-generated text as a source of truth for
    authorization, identity, quota, or consent.
-   Never silently change the agreed stack or introduce an unapproved
    provider.

## Readiness verdict

The planning baseline is sufficiently coherent to begin a small
repository foundation once current external constraints are verified.
Implement in small milestones and revisit a decision only when tests,
provider facts, legal review, or user requirements provide a concrete
reason.
