# H5D2 Durable Retries Report

Status: `DONE`

The original implementation assessment is retained below as interim evidence. The final rebased completion, verification, and commit evidence appended at the end supersedes its missing-gap and failed-gate statements.

## Interim Result

At the interim implementation commit, Core owned a closed, event-projected V2 execution status and a bounded provider retry policy without importing or delegating to V1 runtime code. Live runner activities published fenced start, provider dispatch/completion, retry, success, interruption, and failure transitions; stable status mapped V2 busy/retrying state without changing the public schema.

This interim state was not a complete H5D2 implementation. Restart timer/dispatch recovery, separate status identities for queued roots within one drain, and restarted durable wait errors were unresolved at that point. Those gaps were subsequently exposed by rebased RED commit `76a976f125` and completed by the GREEN commits listed in the final section.

## Interim Architecture

- `SessionRuntime` remains the owner/state/epoch fence. `SessionExecutionStatus` is a separate projection keyed by Session ID.
- An absent status row projects as `idle`; successful settlement deletes it; interrupted and failed terminals remain until a new start.
- `session_execution_status` stores activity/root identity, owner, epoch, last aggregate sequence, and closed encoded status.
- The runner is the status writer. Message, tool, task, shell, and compaction projectors do not independently set execution status.
- `SessionV2` and `SessionControl` expose internal `get`/filtered `list` queries. No native HTTP/OpenAPI/SDK/CLI/TUI surface was added.

## Interim State And Transitions

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

## Interim Retry Policy

Core permits five additional provider dispatches after the initial dispatch. Default waits are exactly `2000`, `4000`, `8000`, `16000`, and `30000` milliseconds.

Hint precedence is `retryAfterMs`, `retry-after-ms`, then `retry-after` seconds or HTTP date. Values must be finite and nonnegative; zero is honored; malformed and past dates are ignored; all hints are capped at 30 seconds. The policy receives current time and the runner uses Effect clock/sleep services rather than `Date.now()`.

Retry is allowed for explicit canonical `retryable: true`, HTTP 429, HTTP 500-599, or protocol `provider-error` with explicit retryability. Invalid request/context overflow, no route/model configuration, authentication, quota, content policy, and invalid provider output deny retry before status/hints are considered. Message text is not classified.

Retry metadata persists only bounded code/action/message/counters/deadline. Messages normalize controls, redact credential-like values, and truncate to 512 UTF-8 bytes. Raw bodies, complete headers, URLs, requests, prompts, payloads, stacks, and arbitrary metadata are not persisted.

A retry reuses the prepared request and structured semantic attempt. It does not increment H5D1 `retry_count`. Retry is suppressed once assistant output or tool activity has started, preventing repeated local side effects. The lower LLM request executor keeps its independently bounded HTTP retries until H6.

## Interim Recovery Matrix

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

## Interim Activity And Wait Concerns

- One initial activity identity currently covers an entire runner drain. A queued root processed later in that drain does not publish prior idle plus a distinct new start, contrary to the brief.
- Current-process `wait` joins coordinator provider/tool/shell/compaction work. `DurableTerminalError` is defined but is not used to surface an equivalent failure to a waiter created after restart.
- Simultaneous restarted timer/startup/explicit wake compare-and-set behavior is not implemented or tested.
- Repeated-identical-tool-call limiting remains deferred because no provider-independent fingerprint and settlement boundary was introduced.

## Interim Stable Mapping

For V2-owned Sessions, Core projection wins over stale V1 process memory. V2 `busy` maps to stable `busy`; `retrying` maps to stable `retry` with safe attempt/message/next metadata. Idle and retained terminal states are omitted, which is the existing stable idle convention and intentionally loses terminal detail until H8. V1-owned Sessions continue using `SessionStatus` and `SessionRetry` unchanged.

## Interim Verification

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

## Interim Changed Files

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

## Interim Checklist

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

## Final Rebased Completion

The rebased residual RED suite demonstrated the remaining durable recovery failures, and the final GREEN implementation closes them:

- Future retry intents register one joined timer and cannot dispatch before `nextAt`; due startup/timer/resume wakes use a synchronized transition claim so only one dispatch wins.
- Explicitly safe `retry-provider` snapshots reconstruct under the original runtime epoch. Unsafe or ambiguous dispatch state settles conservatively without redispatching side effects.
- Provider request, provider transport, and structured semantic attempts have separate identities, preventing deterministic event-ID collisions across tool continuations and structured retries.
- Queued roots publish distinct activity transitions, retained durable terminals surface to later/restarted waits, and real transition timestamps remain idempotent through timestamp-insensitive semantic equivalence.
- Runtime replacement interrupts retry timers and active streams before replacement completes; stale output, fragments, and status writes remain fenced.
- Ordinary interruption durably flushes partial text, reasoning, and tool-input fragments.
- Stable Slopcode status projection exposes V2 busy/retry state and preserves missing-session cancellation behavior without changing public schemas.

The only intentional H5D2 deferrals are those allowed by the brief: provider-independent repeated-identical-tool-call limiting remains deferred because there is no canonical fingerprint/settlement boundary, and lower LLM transport retries remain independently bounded for H6.

## Rebased RED Evidence

- Original contract RED commit after rebase: `da123284af test(core): define durable execution retry contract`.
- Original implementation commit after rebase: `b15b7a9963 feat(core): add durable execution retry state`.
- Residual rebased RED commit: `76a976f125 test(core): expose remaining durable recovery gaps`.
- RED command from `packages/core`: `bun test test/session-execution-status.test.ts test/session-provider-retry.test.ts test/session-execution-local.test.ts test/session-runner.test.ts test/session-projector.test.ts test/session-structured-output.test.ts test/session-structured-output-recovery.test.ts test/session-shell-lifecycle.test.ts test/session-prompt.test.ts`.
- RED result: `252 pass, 14 fail`. Failures exposed future retry registration, concurrent dispatch claiming, conservative unsafe restart settlement, restarted terminal waits, distinct queued-root transitions, runtime replacement interruption, real timestamps, interruption fragment flushing, and request/provider attempt identity collisions.

## GREEN Commits

- `557f14013d fix(core): complete durable retry recovery` completes Core recovery, claiming, attempt composition, terminal waits, interruption fencing, timestamps, and tests.
- `bdc997147e fix(slopcode): expose durable recovery status` completes stable status/error compatibility and HTTP coverage.
- `2328968512 fix(slopcode): preserve isolated server lifecycle` fixes branch-specific full-suite failures found during final verification. Built-in worktree adapters now execute through the captured isolated request graph, and global instance disposal reaches all isolated server stores and PTY location layers.

No commits were pushed.

## Rejected Review Remediation

Status: `DONE`

The H5D2 rejection was reproduced RED-first and fixed without changing H5D1 ownership or retry-count policy.

### Commits

- RED: `772fd3a1be test(core): expose rejected durable recovery gaps`
- GREEN: `662fe33e2b fix(core): harden durable provider recovery`
- REPORT: recorded by the commit containing this section
- Pushes: none

### Protocol And Recovery Results

- Retry-exhausted and nonretryable live `provider-error` streams now fail the runner, retain `terminal-failure`, release the runtime epoch, and fail current and rebuilt waiters with bounded safe messages. They cannot settle as success/idle.
- Every organic retry stores `recovery: retry-provider`, exact request/provider counters, due time, and a 64-character SHA-256 request fingerprint. A test creates this row through the real runner, builds a fresh `SessionExecutionLocal` graph over the same database and process clock, and proves no request before the deadline and exactly one request at the deadline.
- The fingerprint covers agent, selected model/provider/API/variant, harness, system/messages, tool definitions/tool choice, provider options, HTTP/generation/response/cache metadata, and non-secret catalog request configuration. Canonical object keys are sorted and credential-named fields are excluded before hashing; no request, prompt, header, body, URL, or auth value is persisted.
- Restart retry reconstruction computes the same fingerprint before claim or provider I/O. A mismatch terminal-fails with code `restart` and sends no request. Unit canaries prove distinct fingerprints for model, API, variant, request configuration, context, tools, and agent mutations; the runner test proves a forged restart fingerprint terminal-fails without dispatch.
- Startup recovery now wakes safe pre-dispatch work and provider-completed/tool continuation even with no newly admitted input. Explicit startup tests cover a pending local tool continuation, automatic compaction activity, and child task activity; existing full runner/task/shell suites cover interrupted local tools, durable results, shell/manual compaction, and task lifecycle settlement.
- Retry dispatch claim is a database CAS over exact projection sequence, activity/root/epoch/owner plus closed request/provider/fingerprint/due validation. Early or mismatched claims fail without dispatch, and separate rebuilt graphs racing at the deadline produce one winner.
- Retry and terminal messages are normalized at `SessionExecutionStatus`, not only at retry classification. Event/projection schemas cap messages and constrain fingerprints. Redaction covers Basic/Bearer, API key, token, secret, credential, authorization, quoted JSON, quoted assignment, control characters, and optional known secret values. Durable event/status and stable log canaries contain no raw credentials.
- Projection replay, restarted terminal waits, queued roots, local tool/task/shell/compaction recovery, and runtime epoch replacement regressions remain green in the complete Core suite.

### RED Evidence

Command from `packages/core`:

```text
bun test test/session-execution-status.test.ts test/session-provider-retry.test.ts test/session-runner.test.ts
```

Result before GREEN: `214 pass, 5 fail`, `700 expect()` calls. Failures were early retry claim acceptance, unsanitized service-boundary terminal persistence, nonretryable provider-error false success, retry-exhausted provider-error false success, and organic retry state missing safe recovery/fingerprint.

### Final Verification

All test commands were run from package directories, and every listed path exists.

- Core comprehensive recovery command: `bun test test/session-execution-status.test.ts test/session-provider-retry.test.ts test/session-request-fingerprint.test.ts test/session-execution-local.test.ts test/session-runner.test.ts test/session-projector.test.ts test/session-structured-output.test.ts test/session-structured-output-recovery.test.ts test/session-shell-lifecycle.test.ts test/tool-task.test.ts test/session-prompt.test.ts test/session-logging.test.ts`; final component reruns were `207 pass` runner, `20 pass` fingerprint/local recovery, `8 pass` status CAS, `4 pass` retry policy, and `3 pass` logging, all with `0 fail`.
- Core full: `bun test`; `1518 pass, 0 fail`, 158 files, `4706 expect()` calls. This includes migration/schema verification: `16 pass`, including `declared schema has no ungenerated migrations`.
- LLM full: `bun test`; `305 pass, 30 skip, 0 fail`, 26 files, `668 expect()` calls.
- LLM corrected focused paths: `bun test test/executor.test.ts test/provider/openai-chat.test.ts test/provider/openai-responses.test.ts test/provider/anthropic-messages.test.ts test/provider/bedrock-converse.test.ts`; `169 pass, 0 fail`, 5 files, `314 expect()` calls.
- Slopcode focused: `bun test --timeout 30000 test/session/retry.test.ts test/session/prompt.test.ts test/session/control.test.ts test/server/httpapi-session.test.ts test/cli/run/stream.transport.test.ts`; `184 pass, 1 skip, 0 fail`, `648 expect()` calls.
- Slopcode full authoritative rerun: `bun test --timeout 30000`; `3111 pass, 22 skip, 1 todo, 0 fail`, 248 files, 50 snapshots, `8603 expect()` calls. The first full attempt showed no failure but exceeded a 600-second tool timeout; it is not counted as evidence.
- CodeMode full: `bun test`; `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Typecheck: `bun run typecheck` passed in Core, LLM, server, Slopcode, and CodeMode.
- Frozen dependency verification: repository-root `bun install --frozen-lockfile`; passed with `Checked 2372 installs across 2656 packages (no changes)`.
- `git diff --check` passed.
- Generated `.slopcode/package-lock.json` was removed with `apply_patch` and is not retained.

### Concerns

- The request identity is intentionally a one-way canonical fingerprint rather than a persisted request snapshot. This avoids durable prompt/config/auth material while still making any covered semantic mutation fail closed.
- Lower LLM transport retries and repeated-identical-tool-call limiting remain the previously documented H6/deferred scope; this change does not alter those policies.

## Final Verification

All tests were run from package directories. `--timeout 30000` was added to Slopcode runs because its HTTP integration tests legitimately exceed Bun's default per-test timeout.

- Core comprehensive H5D2 focused command from `packages/core`: `bun test test/session-execution-status.test.ts test/session-provider-retry.test.ts test/session-execution-local.test.ts test/session-runner.test.ts test/session-projector.test.ts test/session-structured-output.test.ts test/session-structured-output-recovery.test.ts test/session-shell-lifecycle.test.ts test/session-prompt.test.ts`; `338 pass, 0 fail`, 9 files.
- Corrected Core task lifecycle path is `test/tool-task.test.ts`; the authoritative remediation command above includes it and all listed paths exist.
- Core full command from `packages/core`: `bun test`; `1509 pass, 0 fail`.
- Corrected LLM focused command from `packages/llm`: `bun test test/executor.test.ts test/provider/openai-chat.test.ts test/provider/openai-responses.test.ts test/provider/anthropic-messages.test.ts test/provider/bedrock-converse.test.ts`; `169 pass, 0 fail`, 5 files, `314 expect()` calls.
- LLM full command from `packages/llm`: `bun test`; `305 pass, 30 skip, 0 fail`.
- Slopcode focused command from `packages/slopcode`: `bun test --timeout 30000 test/session/retry.test.ts test/session/prompt.test.ts test/session/control.test.ts test/server/httpapi-session.test.ts test/cli/run/stream.transport.test.ts`; `184 pass, 1 skip, 0 fail`, 5 files, `648 expect()` calls.
- Slopcode full command from `packages/slopcode`: `bun test --timeout 30000`; `3111 pass, 22 skip, 1 todo, 0 fail`, 248 files, 50 snapshots, `8602 expect()` calls.
- CodeMode full command from `packages/codemode`: `bun test`; `254 pass, 0 fail`.
- Core, LLM, server, Slopcode, and CodeMode each passed `bun run typecheck` from their package directory after the final source commit.
- Migration/schema command from `packages/core`: `bun test test/database-migration.test.ts`; `16 pass, 0 fail`, including `declared schema has no ungenerated migrations`.
- Frozen install command from the repository root: `bun install --frozen-lockfile`; passed with `Checked 2372 installs across 2656 packages (no changes)`.
- `git diff --check` passed.
- Core source search for `SessionRetry`, `session/retry`, `session/status`, `packages/slopcode`, and `@/session` imports under `packages/core/src/session` returned no forbidden V1/Slopcode dependencies.
- Retry event schemas persist only closed identity/counter/code/action/deadline/message fields. Redaction canaries prove raw bodies, headers, URLs, requests, prompts, metadata, stacks, credentials, and tokens are absent from durable retry events, projections, logs, and stable status.
- The generated `.slopcode/package-lock.json` was removed with `apply_patch` after test generation and is not retained.

## Full-Suite Failure Diagnosis

The first completed full Slopcode run reported `5` failures: one PTY disposal assertion, one load-sensitive listener stop timeout, and three worktree workspace failures. Isolation produced `7 pass, 1 fail` for PTY, `8 pass, 1 fail` for workspace HTTP, `4 pass, 2 fail` for worktree endpoint reproduction, and `11 pass, 0 fail` for the listener file.

The deterministic failures were caused by the branch's isolated `Server.Default()` graph owning different instance/database/worktree services from `AppRuntime`: worktree adapters crossed into the wrong graph, while global disposal reached only the AppRuntime store. Commit `2328968512` repairs those ownership boundaries. Post-fix isolation passed with `15 pass, 0 fail` across workspace/worktree, `8 pass, 0 fail` for PTY, `9 pass, 0 fail` for instance-store concurrency, and the final full Slopcode suite passed with no failures. The listener timeout did not reproduce in isolation or in the final full suite.

## Final Disposition

`DONE`: all binding H5D2 recovery gaps are implemented, all requested focused/full suites and validation gates pass, all intended source and report changes are committed, and no release or push was performed.

## Atomic Recovery Re-review Remediation

This section supersedes the earlier rejected-review claims about dispatch CAS, generic provider completion, excluded credentials, character-count bounds, and Slopcode full-suite status.

### Commits

- RED: `4a00b044e0 test(core): expose atomic recovery gaps`
- GREEN: `ba226a7c19 fix(core): make durable recovery claims atomic`
- REPORT: recorded by the commit containing this section
- Pushes: none

### Atomic Dispatch

- `SessionExecutionStatus.dispatch` no longer changes the projection sequence before event publication.
- Due time, request/provider counters, fingerprint, activity/root, owner, runtime state, and epoch are validated by the synchronized event guard inside `EventV2`'s immediate database transaction.
- The deterministic `ProviderDispatched` insertion and status projection happen in that same transaction. The local winner flag is set only by the new-event commit callback, which is skipped for an idempotent loser.
- A forced insertion failure proves both the event and status projection roll back. A barrier test constructs two independent `EventV2` and `SessionExecutionStatus` services over one database, releases both claims together, and calls the fake `llm.stream` exactly once.

### Completion Recovery

- Generic `ProviderCompleted` has no recovery intent. Startup conservatively terminalizes a completed success-before-settlement, failed-before-retry, or nonretryable-before-terminal window without provider redispatch.
- `ContinuationReady` is a distinct synchronized event. It is emitted only after durable local tool settlement, durable structured retry state, completed overflow compaction, or admitted steering input proves another provider turn is required.
- Startup and direct runner recovery resume only explicit `continue-provider`, safe pre-dispatch preparation, or durable shell/manual-compaction/task records. A generic completed `tool` phase or non-prompt activity is not sufficient.
- Real runner tests prove a local tool result precedes `ContinuationReady`, which precedes the second provider dispatch; overflow compaction emits compaction readiness; resumed child tasks complete end to end and persist task-root execution status.

### Request Identity And Bounds

- Credential-valued authorization, proxy authorization, auth, cookie, API-key, token, secret, credential, password, and set-cookie fields are represented by domain-separated SHA-256 digests in canonical request identity instead of being omitted or persisted as plaintext.
- Route auth is included. Canonical key ordering and array paths make the same request restart-stable; low-entropy and plaintext canaries, authorization/header/cookie/API-key mutations, and existing persisted event/status/log canaries pass.
- The final persisted identity remains one outer SHA-256 value. No request, prompt, header, cookie, API key, or credential plaintext is stored.
- Closed retry and terminal event/status schemas now enforce `512` UTF-8 bytes with `TextEncoder`, while service-boundary sanitization remains. Direct synchronized publication accepts `128` four-byte emoji and rejects `129`.

### Added Coverage

- Complete execution status projection removal and ordered replay from the synchronized event log.
- A newly built status/session graph returns the retained durable terminal to a waiter.
- Real shell, manual compaction, automatic overflow compaction, local tool, and resumed child-task lifecycle evidence.
- Epoch replacement projection in tool, shell, task, and compaction phases.
- Retry policy boundaries `500`, `599`, and `600`; malformed, negative, stale-date, and future-date hints; and all deny classes.
- Parented child sessions are now classified as task roots for both admitted pending input and fallback execution, even if immutable task metadata is temporarily unavailable.

### RED Evidence

Command from `packages/core`:

```text
bun test test/session-execution-status.test.ts test/session-execution-local.test.ts test/session-request-fingerprint.test.ts test/session-provider-retry.test.ts
```

Result before GREEN: `31 pass, 6 fail`, `130 expect()` calls. One replay test setup was then corrected to order events by aggregate sequence; the product failures were independent status mutation surviving event rollback, credential mutations collapsing to one identity, generic completion redispatch, multibyte schema overrun acceptance, and HTTP `600` retry.

### Final Verification

- Focused Core status/recovery/policy command: `bun test test/session-execution-status.test.ts test/session-execution-local.test.ts test/session-provider-retry.test.ts test/session-request-fingerprint.test.ts test/session-prompt.test.ts`; `78 pass, 0 fail`, `318 expect()` calls.
- Complete runner: `bun test test/session-runner.test.ts`; `207 pass, 0 fail`, `669 expect()` calls.
- Core full: `bun test`; `1526 pass, 0 fail`, 158 files, `4751 expect()` calls.
- LLM full: `bun test`; `305 pass, 30 skip, 0 fail`, 26 files, `668 expect()` calls.
- CodeMode full: `bun test`; `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Core, LLM, server, Slopcode, and CodeMode passed `bun run typecheck`.
- Slopcode focused recovery integration: `bun test --timeout 30000 test/session/retry.test.ts test/session/prompt.test.ts test/session/control.test.ts test/server/httpapi-session.test.ts test/cli/run/stream.transport.test.ts`; `184 pass, 1 skip, 0 fail`, `648 expect()` calls.
- Repository-root `bun install --frozen-lockfile` passed with `Checked 2372 installs across 2656 packages (no changes)`.
- `git diff --check` passed.
- The generated `.slopcode/package-lock.json` was inspected and removed with `apply_patch`; it is not retained.
- Slopcode full default run exceeded a 15-minute command timeout without a final result. A completed rerun under heavy unrelated host load reported `3065 pass, 22 skip, 1 todo, 46 fail`; all failures were fixed 5-second HTTP/server timeouts.
- Slopcode full serial rerun, `bun test --max-concurrency 1`, reported `3082 pass, 22 skip, 1 todo, 29 fail`; every failure was again an unrelated fixed 5-second timeout while neighboring HTTP tests took 5-12 seconds.
- Complete serial server isolation, `bun test test/server --max-concurrency 1`, reported `283 pass, 2 skip, 14 fail`; remaining failures were fixed 5-second timeouts, while many cases that failed in the full runs passed in isolation. No failure referenced the changed Core recovery code or asserted incorrect behavior.

### Concerns

- The domain-separated credential digest is intentionally unkeyed SHA-256, which satisfies stable cross-restart identity without installation-key lifecycle risk. It is persisted only inside the outer request fingerprint, not directly; low-entropy values are therefore not visible, although an installation-key HMAC would provide stronger defense if canonical identity were ever exposed internally.
- The Slopcode aggregate suite could not produce a green run under current unrelated host contention. Core and every affected recovery/lifecycle test are green, but the fixed-timeout Slopcode failures remain an environmental verification gap and are not represented as passing.

## Final Review Remediation

This section supersedes the preceding unkeyed credential-digest concern and Slopcode full-suite verification gap.

### Commits

- RED: `82a6f334f4 test(core): expose final H5D2 recovery gaps`
- GREEN: `a1aafad38c fix(core): close final recovery crash windows`
- REPORT: recorded by the commit containing this section
- Pushes: none

### Continuation Reconstruction

Startup reconstructs a missing `ContinuationReady` only for the current completed request/provider attempt and fingerprint. A later dispatch, retry schedule, execution terminal, or failed step disqualifies the evidence.

- Local tool evidence requires at least one provider-unexecuted call in the completed attempt, every such call to have a matching provider-unexecuted durable success/failure settlement, and a durable successful step ending with `finish: tool-calls`.
- Structured evidence requires a post-completion `Structured.Retry` for the current root with `remaining > 0` and no later structured result/failure consuming it.
- Overflow evidence requires matching post-completion automatic compaction start/end records and no later compaction failure.
- Steering evidence requires a durable pending admitted `steer` input. It is a distinct admitted root, not redispatch of generic provider completion.
- Reconstructed proof publishes the deterministic `ContinuationReady` transition before one coordinator wake. Generic successful, failed-before-retry, and nonretryable-before-terminal `ProviderCompleted` windows without proof retain restart interruption behavior.
- Crash-window tests persist each proof without its marker, rebuild the local execution graph, and observe exactly one continuation and one reconstructed marker per case.

### Installation-Scoped Identity

- `SessionRequestFingerprint` is now an injected service. It uses HMAC-SHA-256 for credential-named canonical fields, an installation-bound domain-separated HMAC tag in the outer canonical identity, and a final SHA-256 fingerprint.
- The 32-byte key is stored under Global data at `identity/request-fingerprint.key`. The directory is checked as a non-symlink directory and forced to mode `0700`; the key is checked as a non-symlink regular file and forced to mode `0600`.
- Creation writes and synchronizes a private uniquely named temporary file, then atomically hard-links it into place. Concurrent creators accept only the single installed key and remove their temporary files. Existing symlink paths are rejected.
- The key is never logged or stored in events, execution status, or the database. Persisted recovery state remains only the outer 64-character fingerprint.
- Tests cover concurrent creation, permissions, same-install restart stability, different credentials, distinct installations, directory/file symlink rejection, low-entropy/plaintext canaries, and a copied retry database whose missing key causes `RestartRequestMismatch`, terminal code `restart`, and zero recovery provider requests.

### Canonical Events And Replay

- `ContinuationReady` is included in `ExecutionDefinitions`, `Durable`, and `All`; the exhaustive message updater handles it as a no-op.
- Canonical schema checks accept it, `SessionV2.events` streams it, and the execution projector remains deterministic.
- Full projection removal/replay now covers continuation state, retained terminal failure, and successful row deletion/idle. Existing real tool/shell/task/compaction epoch replacement coverage remains green.

### RED Evidence

Command from `packages/core`:

```text
bun test test/session-execution-local.test.ts test/session-execution-status.test.ts test/session-request-fingerprint-key.test.ts
```

Result before GREEN: `32 pass, 5 fail`, `103 expect()` calls. Failures were missing proof reconstruction, omission from canonical event unions, and the absent installation-key service/lifecycle.

### Final Verification

- Focused Core: `bun test test/session-execution-local.test.ts test/session-execution-status.test.ts test/session-projector.test.ts test/session-request-fingerprint.test.ts test/session-request-fingerprint-key.test.ts test/session-runner.test.ts`; `261 pass, 0 fail`, `834 expect()` calls.
- Core full: `bun test --only-failures`; `1533 pass, 0 fail`, 159 files, `4772 expect()` calls.
- LLM full: `bun test --only-failures`; `305 pass, 30 skip, 0 fail`, 26 files, `668 expect()` calls.
- Server full: `bun test --only-failures`; `4 pass, 0 fail`, `19 expect()` calls.
- CodeMode full: `bun test --only-failures`; `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Core, LLM, server, Slopcode, and CodeMode passed `bun run typecheck`.
- Repository-root `bun install --frozen-lockfile` passed: `Checked 2372 installs across 2656 packages (no changes)`.
- The first Slopcode `bun run test` attempt used the package's `--timeout 30000` but was externally terminated after 900 seconds before a result while still advancing through files.
- The exact Slopcode package command was rerun with a longer process ceiling and completed: `3111 pass, 22 skip, 1 todo, 0 fail`, 248 files, 50 snapshots, `8601 expect()` calls in 868.83 seconds.
- `git diff --check` passed. The generated `.slopcode/package-lock.json` was inspected and removed; it is not retained.

### Concerns

- Deleting or losing the installation key intentionally invalidates persisted in-flight request identities. Recovery then terminalizes with code `restart` before provider I/O; completed history and non-recovery behavior are unaffected.
- The first full Slopcode attempt hit only the external 15-minute process ceiling. The completed rerun with the same package-level 30-second test timeout had no failures, so no Slopcode test gap remains.
