# UI/UX Specification

## Visual direction

-   Premium modern SaaS interface.
-   Primary palette: indigo `#4F46E5`, violet `#7C3AED`, soft indigo
    `#EEF2FF`, white `#FFFFFF`, charcoal `#171827`.
-   Typography: Inter.
-   Use restrained gradients, subtle borders and shadows, moderate
    corner radii, and clear visual hierarchy.
-   Verify contrast against WCAG 2.2 AA; palette tokens alone do not
    guarantee accessible contrast.

## Responsive principles

-   Spacious, constrained text sections on landing pages.
-   Efficient data layouts on dashboard/history pages.
-   Focused distraction-free interview room.
-   Desktop: compact labeled dashboard sidebar.
-   Mobile: collapsible navigation and stacked layouts; test the
    interview room carefully for browser speech/camera limitations.

## Page inventory

### Public

-   Landing page
-   Sign in
-   Register
-   Email verification / recovery states
-   Privacy notice
-   Terms
-   Contact/support

### Authenticated workspace

-   Dashboard
-   Start interview wizard
-   Interview room
-   Interview processing/status
-   Report detail
-   Interview history
-   My progress
-   Settings (profile, security/sessions, email preferences,
    consent/personalization, saved resume, data export/deletion)

### Guest

-   Guest entry
-   Interview wizard and room
-   Temporary report
-   Explicit report-transfer/signup flow

## Navigation

Workspace: - Dashboard - Start Interview - Interview History - My
Progress

Account: - Settings

Interview type is selected inside Start Interview, not in the persistent
navigation. Reports are opened from history and post-interview actions.

## Dashboard hierarchy

1.  Prominent Start Interview action.
2.  Recent performance summary and trend, only if enough comparable data
    exists.
3.  Recent interviews.
4.  One prioritized next step.
5.  Strengths and improvement areas where supported.
6.  Empty states that explain how to begin without inventing data.

## Interview setup wizard

1.  Choose interview type.
2.  Configure role, difficulty, duration, and relevant optional context.
3.  Review settings, microphone requirements, privacy, and consent.
4.  Start only after setup and required operations succeed.

Preserve inputs on back navigation. Show validation near fields. Clearly
distinguish user-supplied company information from verified information.

## Interview room

-   Avatar and current question are visually primary.
-   Keep the full question readable while speech plays.
-   Show timer, question number, and state clearly.
-   Camera preview is optional and secondary.
-   Mic state and active capture are unmistakable.
-   Start Answer → Stop Answer → review transcript → Confirm.
-   No auto-submit on silence or speech-recognition stop.
-   Provide retry and text fallback.
-   After answer persistence, student explicitly chooses Continue to
    Next Question.
-   Pause between questions; timer pauses while paused.
-   Prevent overlapping interviewer speech and answer capture.
-   No automatic microphone/camera activation.

## Report

-   Overall score and summary.
-   Six dimension scores with evidence and uncertainty.
-   Strengths and priority improvements.
-   Expandable question-by-question review.
-   Illustrative stronger answer/framework clearly labeled as an
    example.
-   Incomplete status where appropriate.
-   One primary next-practice recommendation and secondary Start New
    Interview.
-   Print-friendly browser PDF layout.

## States every major flow needs

-   Loading
-   Empty
-   Validation error
-   Permission denied
-   Network failure
-   Provider failure
-   Retry in progress
-   Partial/incomplete
-   Success
-   Expired session
-   Access denied
-   Consent declined/withdrawn
-   Deleted/unavailable data

## Motion and feedback

Use restrained motion for transitions and avatar state changes. Respect
reduced-motion preferences. Never use fake percentage progress or
countdowns for background evaluation; show truthful stages only.

## Design workflow

1.  Wireframe primary user journeys in Figma.
2.  Review responsive states and edge cases.
3.  Define design tokens and shared components.
4.  Polish landing page.
5.  Implement the dashboard and setup wizard.
6.  Implement the interview room and report.
7.  Test keyboard access, contrast, responsive layouts, and reduced
    motion before visual polish is considered complete.
