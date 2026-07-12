# H5D2 Durable Retries Report

Status: `DONE_WITH_CONCERNS`

## Result

Core now owns a closed, event-projected V2 execution status and a bounded provider retry policy without importing or delegating to V1 runtime code. Live runner activities publish fenced start, provider dispatch/completion, retry, success, interruption, and failure transitions; stable status maps V2 busy/retrying state without changing the public schema.

This is not a complete H5D2 implementation. Restart timer/dispatch recovery, separate status identities for queued roots within one drain, and restarted durable wait errors remain unresolved. The implementation is committed because its live path, projection, policy, compatibility bridge, and migrations are useful and fully identified below, but it must not be represented as satisfying the complete binding brief.

## Architecture

- `SessionRuntime` remains the owner/state/epoch fence. `SessionExecutionStatus` is a separate projection keyed by Session ID.
- An absent status row projects as `idle`; successful settlement deletes it; interrupted and failed terminals remain until a new start.
- `session_execution_status` stores activity/root identity, owner, epoch, last aggregate sequence, and closed encoded status.
- The runner is the status writer. Message, tool, task, shell, and compaction projectors do not independently set execution status.
- `SessionV2` and `SessionControl` expose internal `get`/filtered `list` queries. No native HTTP/OpenAPI/SDK/CLI/TUI surface was added.

## State And Transitions

Closed states: `idle`, `busy`, `retrying`, `interrupted`, `terminal-failure`.

Closed activities: `prompt`, `shell`, `compaction`, `task`.

Closed phases: `preparing`, `provider`, `tool`, `shell`, `compaction`, `task`, `settling`.

Terminal codes: `interrupted`, `restart`, `runtime-replaced`, `provider-nonretryable`, `provider-exhausted`, `runner-failure`, `step-limit`.

| Event | Legal predecessor | Projection | Runtime settlement |
| --- | --- | --- | --- |
| activity started | idle or retained terminal | busy | unchanged draining epoch |
| provider dispatched | busy/retrying | busy/provider | unchanged |
| provider completed | busy | busy/provider | unchanged |
| retry scheduled | busy | retrying with attempt/deadline | unchanged |
| activity succeeded | busy | delete row/idle | ready, epoch + 1 in event transaction |
| activity interrupted | busy/retrying | retained interrupted | ready/resulting epoch in event transaction |
| activity failed | busy/retrying | retained terminal-failure | ready/resulting epoch in event transaction |

Every publication checks exact V2 owner, draining state, epoch, activity identity, and legal predecessor under the synchronized event transaction. Event IDs hash Session ID, activity ID, root ID, epoch, structured attempt, provider attempt, and transition kind. Including epoch prevents a legitimate later execution of the same root from conflicting with an earlier activity. Duplicate identical transitions are idempotent; conflicting payloads fail closed.

Execution event timestamps are currently fixed to epoch zero so a duplicate semantic publication has byte-identical payload. This preserves idempotency but is a remaining metadata concern.

## Retry Policy

Core permits five additional provider dispatches after the initial dispatch. Default waits are exactly `2000`, `4000`, `8000`, `16000`, and `30000` milliseconds.

Hint precedence is `retryAfterMs`, `retry-after-ms`, then `retry-after` seconds or HTTP date. Values must be finite and nonnegative; zero is honored; malformed and past dates are ignored; all hints are capped at 30 seconds. The policy receives current time and the runner uses Effect clock/sleep services rather than `Date.now()`.

Retry is allowed for explicit canonical `retryable: true`, HTTP 429, HTTP 500-599, or protocol `provider-error` with explicit retryability. Invalid request/context overflow, no route/model configuration, authentication, quota, content policy, and invalid provider output deny retry before status/hints are considered. Message text is not classified.

Retry metadata persists only bounded code/action/message/counters/deadline. Messages normalize controls, redact credential-like values, and truncate to 512 UTF-8 bytes. Raw bodies, complete headers, URLs, requests, prompts, payloads, stacks, and arbitrary metadata are not persisted.

A retry reuses the prepared request and structured semantic attempt. It does not increment H5D1 `retry_count`. Retry is suppressed once assistant output or tool activity has started, preventing repeated local side effects. The lower LLM request executor keeps its independently bounded HTTP retries until H6.

## Recovery Matrix

| Durable state | Current behavior | Required follow-up |
| --- | --- | --- |
| idle/absent, no work | no execution | none |
| admitted pending work | existing lane recovery wakes it | covered |
| busy/retrying status row | runtime is no longer blanket-paused | incomplete: no status-aware dispatch/timer recovery scan |
| unresolved shell/task/tool | existing explicit interrupted/unknown settlement remains | covered by existing suites |
| interrupted/failure terminal | retained and not cleared by admission alone | covered |
| future retry deadline | no restarted timer registration | missing |
| due retry deadline | no immediate compare-and-set claim | missing |
| uncertain provider dispatch | recovery intent is stored, but not consumed at startup | missing |

Because status-backed draining sessions are returned by `SessionRuntime.recover` but `SessionExecutionLocal` only wakes known pending input/shell/compaction/task work, a process restart during provider busy/retrying can remain stranded. No unsafe provider redispatch was added, but the required conservative recovery behavior is absent.

## Activity And Wait Concerns

- One initial activity identity currently covers an entire runner drain. A queued root processed later in that drain does not publish prior idle plus a distinct new start, contrary to the brief.
- Current-process `wait` joins coordinator provider/tool/shell/compaction work. `DurableTerminalError` is defined but is not used to surface an equivalent failure to a waiter created after restart.
- Simultaneous restarted timer/startup/explicit wake compare-and-set behavior is not implemented or tested.
- Repeated-identical-tool-call limiting remains deferred because no provider-independent fingerprint and settlement boundary was introduced.

## Stable Mapping

For V2-owned Sessions, Core projection wins over stale V1 process memory. V2 `busy` maps to stable `busy`; `retrying` maps to stable `retry` with safe attempt/message/next metadata. Idle and retained terminal states are omitted, which is the existing stable idle convention and intentionally loses terminal detail until H8. V1-owned Sessions continue using `SessionStatus` and `SessionRetry` unchanged.

## Verification

RED commit: `1b3abd79cf test(core): define durable execution retry contract`.

Initial RED command:

```text
cd packages/core && bun test test/session-execution-status.test.ts test/session-provider-retry.test.ts
```

Initial result: module resolution failed for missing `@slopcode-ai/core/session/execution-status` and `@slopcode-ai/core/session/provider-retry`.

GREEN implementation commit: `116d1403d6 feat(core): add durable execution retry state`.

Passing gates:

- Core focused command: `247 pass, 0 fail`, including execution status, retry policy, local execution, runner, projector, structured output/recovery, and shell lifecycle.
- Core full: `1496 pass, 0 fail`.
- LLM focused: `154 pass, 0 fail`.
- LLM full: `305 pass, 30 skip, 0 fail` (recorded tests skipped by existing fixture policy).
- Slopcode retry, prompt, and control portions completed successfully in the specified combined run before HTTP failures; standalone control was `19 pass, 0 fail`.
- CLI transport: `30 pass, 0 fail`.
- Codemode full: `254 pass, 0 fail`.
- `bun run typecheck` passed in Core, LLM, server, Slopcode, and codemode.
- `bun install --frozen-lockfile` passed with no dependency changes.
- `git diff --check` passed.
- Migration check passed: `declared schema has no ungenerated migrations`.
- Source search found no Core imports of V1 runtime, Slopcode runtime, or `SessionRetry`.

Slopcode HTTP gate did not pass. Standalone result was `15 pass, 8 fail`: one unchanged missing-session abort expectation returned HTTP 400 instead of expected 200, and seven tests exceeded their hard 5-second timeout. An isolated native V2 prompt completed in about 5.26 seconds and therefore timed out. Assertions/timeouts were not weakened. Full Slopcode was not run after this known focused failure.

No dedicated crash-restart, due-time race, restarted durable wait, raw-log canary, or per-queued-root status tests exist. Policy date/delay tests are deterministic pure tests; no complete virtual-time restarted runner test exists.

## Changed Files

| Path | Purpose |
| --- | --- |
| `packages/core/src/session/execution-status.ts` | closed status schema, service, event IDs, guards, projectors, terminal release |
| `packages/core/src/session/provider-retry.ts` | retry classification, hints, backoff, budget, sanitization |
| `packages/core/src/session/event.ts` | synchronized execution lifecycle event family |
| `packages/core/src/session/sql.ts` | status projection table |
| `packages/core/src/database/migration/20260712155937_session_execution_status.ts` | generated table/index migration |
| `packages/core/schema.json` | generated Drizzle snapshot |
| `packages/core/src/database/migration.gen.ts` | generated migration registry |
| `packages/core/src/database/schema.gen.ts` | generated fresh database schema |
| `packages/core/src/session/projector.ts` | execution projector registration |
| `packages/core/src/session/message-updater.ts` | execution events excluded from message mutation |
| `packages/core/src/session/runner/llm.ts` | activity lifecycle, provider dispatch/retry, fenced settlement |
| `packages/core/src/session/runtime.ts` | avoid blanket-pausing sessions with projected execution state |
| `packages/core/src/session/input.ts` | pending input lookup used for root selection |
| `packages/core/src/session.ts` | internal status query APIs |
| `packages/core/src/session/control.ts` | owner-aware status control APIs |
| `packages/core/src/location-layer.ts` | runner status service composition |
| `packages/server/src/handlers.ts` | shared server status service graph |
| `packages/slopcode/src/session/control.ts` | stable bridge status access |
| `packages/slopcode/src/server/routes/instance/httpapi/handlers/session.ts` | owner-precedence stable status merge |
| `packages/core/test/session-execution-status.test.ts` | projection, terminal retention, duplicate/epoch/fence coverage |
| `packages/core/test/session-provider-retry.test.ts` | policy, hint, deny, sanitization, budget coverage |
| `packages/core/test/session-runner.test.ts` | live exhaustion/no-retry-after-output and lifecycle regressions |
| `packages/core/test/session-projector.test.ts` | shared status fixture composition |
| `packages/core/test/session-runner-recorded.test.ts` | durable execution event sequence evidence |
| `packages/slopcode/test/session/control.test.ts` | stable control fixture/API compatibility |

## Checklist

- PASS: Core-owned closed projection and policy without V1 delegation.
- PASS: runtime and execution state are separate and transactionally fenced.
- PASS: admission alone does not mark busy or clear retained terminals.
- PARTIAL: one root covers nested work, but queued roots in one drain are not distinct status activities.
- PASS: implemented transitions are durable, deterministic, idempotent, closed, bounded, and replayable.
- PASS: live busy/dispatch and stale publication fences.
- PASS: live success/interruption/failure/exhaustion and terminal replacement.
- PASS: five-additional live budget, backoff, hints, caps, deny classes, and bounded metadata.
- PASS: provider and structured counters remain separate in the live path.
- PASS: existing tool/task/shell/compaction side-effect recovery suites remain green.
- PARTIAL: current-process wait joins live work; restarted terminal wait is missing.
- PASS: internal Core queries and schema-compatible stable mapping.
- PASS: V1 status/retry behavior was not delegated to or modified.
- PASS: H6/H7/H8, SDK regeneration, snapshot, formatter, LSP, and Ultra scope stayed out.
- FAIL: complete restart recovery matrix and concurrent durable timer claim.
- FAIL: full Slopcode verification gate.
