# Task H5B1 Report

## Status

Complete. Manual V2 compaction is durably admitted, serialized through the live Session lane, recovered after restart, and settled independently of unrelated prompt generations.

## Lifecycle Design

- `Compaction.Requested` durably records the message ID and optional text instruction before scheduling execution.
- Manual `Compaction.Ended` is the successful checkpoint terminal. `Compaction.Skipped` is the successful empty-history terminal, and `Compaction.Failed` stores a safe typed failure without changing active context.
- Request and terminal event IDs are deterministic from the message ID. Concurrent retries and terminal races therefore have one durable winner, and exact retries read the original result.
- `SessionV2.compact` performs admission and wake registration uninterruptibly, then waits on EventV2's subscribe-before-replay aggregate stream for that exact terminal ID. It does not use coordinator-idle waiting or a check-then-subscribe race.
- `SessionRunnerLLM` checks manual work before no-work return and at settled provider-activity boundaries. Required tool continuation finishes first; manual requests then drain under the active owner/epoch fence before later coalesced prompts, while the compact caller returns at its own terminal.
- Provider execution is interruptible, but terminal failure settlement stays masked. A stale epoch cannot publish `Ended`; only a raw non-checkpoint failure terminal is allowed after the fence is lost.
- Startup recovery unions normal runtime recovery rows with V2-owned session IDs found through unterminated `Compaction.Requested` events, including the crash window before runtime state changes from `ready`.

## RED Evidence

- The custom-instruction prompt test initially failed because `buildPrompt` ignored the instruction.
- The first interruption test timed out because failure settlement ran after leaving the uninterruptible mask.
- The active-drain ordering regression showed a queued prompt provider call starting before manual compaction.
- The ready-state restart regression timed out because `SessionRuntime.recover()` alone cannot discover admission-before-lane-start crashes.
- The old HTTP compact test returned the expected `503` unavailable response before implementation.

## GREEN Evidence

- Full Core suite: `1196 pass`, `0 fail`.
- Full SessionRunnerLLM suite: `125 pass`, `0 fail`.
- Focused compaction/runner/recovery suites: `133 pass`, `0 fail`.
- Affected HTTP session and public OpenAPI suites: `39 pass`, `0 fail`.
- Core typecheck: passed.
- Server typecheck: passed.
- Changed-file oxlint: `0 errors` (`84 warnings`, including existing warnings in the touched large files).
- `git diff --check`: passed.
- Slopcode typecheck remains blocked by unrelated existing errors in `src/session/processor.ts:495` and `test/v2/session-message-updater.test.ts:168`.

## Changes

- Added durable manual request, no-op, and failure events while preserving existing Started/Ended history projection.
- Added typed conflict, unsupported-prompt, and safe terminal failure errors plus optional message-ID idempotency.
- Refactored automatic, overflow, and manual compaction onto one bounded summarization implementation.
- Added zero-recent-token manual selection, prior-summary anchoring, deterministic custom instructions, and failure classification.
- Added runner fencing, interruption settlement, active-turn ordering, multi-request draining, and ready/paused startup recovery.
- Replaced the native HTTP unavailable response with typed compact payload, success, conflict/request, and safe failure contracts.
- Kept shell unavailable and made no V1, migration, subagent, MCP/plugin, or SDK changes.

## Files

- `packages/core/src/session.ts`
- `packages/core/src/session/compaction.ts`
- `packages/core/src/session/control.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/input.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/projector.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/test/session-compaction.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/server/src/groups/session.ts`
- `packages/server/src/handlers/session.ts`
- `packages/slopcode/test/server/httpapi-public-openapi.test.ts`
- `packages/slopcode/test/server/httpapi-session.test.ts`
- `.superpowers/sdd/task-h5b1-report.md`

## Commits

- `4714950e75 feat(session): add durable manual V2 compaction`
- `d7ee142d86 fix(session): harden manual compaction ordering`
- Nothing was pushed.

## Self-Review

- Only a successful manual `Ended` projects a compaction message and requests context replacement.
- Every admitted request has a deterministic terminal path for success, no history, provider failure, empty output, invalid budget, interruption, execution failure, or epoch loss.
- Exact terminal waiting cannot miss a fast completion and does not wait for later prompt work.
- Concurrent prompts and multiple manual requests remain serialized by the existing coordinator; no manual success creates a synthetic assistant continuation.
- The shared summarizer receives the deterministic terminal ID from the durable request owner instead of constructing persistence identifiers itself.
- `SessionV2.defaultLayer` uses a lazy `Layer.suspend` boundary to break the existing session/location default-layer TDZ without changing service ownership or runtime behavior.
- Startup recovery does not repeat requests that already have any terminal event.

## Concerns

- Event-log scans are intentionally used instead of a new projection table because H5B1 excludes migrations. The deterministic IDs and aggregate/type index keep lookups bounded by one Session's compaction request count; a future migration may add a dedicated projection if volume warrants it.
- The unrelated Slopcode typecheck failures remain outside H5B1 scope.
