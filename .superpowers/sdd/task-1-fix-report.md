# Task 1 remediation fix report

## outcome

Production `ssh-agentic-session.tsx` is now wired to the agent-session projection and renders a compact message-first workspace. It includes an IME-aware bottom composer, immediate local user messages, typed conversation entries, collapsible reasoning, interaction focus/live semantics, visible review tabs with explicit metadata-only empty states, detached restoration messaging, and the existing Diagnostics/Interactive CLI disclosure.

Persistence is versioned and explicitly remote-session-bound. A workspace pointer locates a session-specific opaque record; restored history is shown as a detached local snapshot and is never treated as an attached remote session. Starting a new remote session resets the active projection, and events whose `sessionID` differs from the active projection are ignored.

The persisted projection is independently normalized, redacted, capped at 96 KiB UTF-8, and limited to allowlisted fields. Common password/token/API-key/Bearer/JWT/private-key forms are redacted, approval command details are omitted, and bounded tool/artifact metadata is retained for honest review surfaces.

## files changed

- `packages/android/src/ssh-agent-session-state.ts` — session-bound v2 projection persistence, UTF-8 total bound, embedded-secret redaction, command omission, cross-session rejection, and bounded review metadata.
- `packages/android/src/ssh-agent-session-state.test.ts` — protocol-shaped reducer, review, session isolation, redaction, command omission, and total serialized-size coverage.
- `packages/android/src/ssh-agentic-session.tsx` — production projection wiring and message-first UI with typed entries, focus/live semantics, review tabs, detached restoration, and preserved diagnostics.
- `packages/android/src/ssh-shell.css` — fixed-height agent workspace and IME-aware sticky composer layout.
- `packages/android/src/ssh-shell-accessibility.test.ts` — source-level production DOM/accessibility and persistence wiring assertions.
- `.superpowers/sdd/task-1-fix-report.md` — this report.

## validation completed

- Baseline before remediation: `bun test src` passed 129 tests with 575 assertions.
- Baseline before remediation: `bun run typecheck` passed.
- RED: the expanded state suite failed to load because `MAX_PERSISTED_AGENT_SESSION_BYTES` and the session-bound API did not exist.
- GREEN: `bun test src/ssh-agent-session-state.test.ts` passed 6 tests with 40 assertions after the state implementation.
- Targeted regression run after production UI wiring: 18 tests passed with 196 assertions across the state, orchestrator, source-regression, and existing accessibility suites.
- `bun run typecheck` passed after the production UI wiring and its reported type errors were fixed.

## incomplete and unverified requirements

- The final additions to `ssh-shell-accessibility.test.ts` were not rerun because immediate finalization was requested.
- No dynamic browser DOM fixture/journey was added. The added UI coverage is source-level, so first-viewport geometry, real focus movement, live-region behavior, sticky positioning, and IME movement are not browser-verified.
- `AndroidUiInstrumentedTest.kt` was not updated. The existing test covers only part of prompt → approval → question and still targets the previous presentation; it does not cover stream → review → complete, recreation restoration, session mismatch reset, interaction focus/live semantics, or IME-sticky composer behavior.
- Gradle unit tests and Android-test compilation were not run.
- Android package web/Android builds and the full post-change package test suite were not run.
- No connected-device instrumented run was performed.

Task 1 must not be considered complete until the dynamic DOM/accessibility journey and Android instrumented recreation/IME journey are implemented and passing, and the requested package/build/Gradle validation is green.
