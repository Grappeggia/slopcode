# Task H5C1 Report

## Status

Complete. Foreground V2 subagent tasks now use one Location-scoped canonical `task` tool, durable parent/child identity, and the authoritative child Session execution lane. No V1 runtime or `BackgroundJob` execution path is used.

## Lifecycle Design

- Plugin boot completes before the task catalog is captured. Catalog text is deterministic by agent ID, excludes hidden/primary agents, and applies the caller's immutable materialized `task` permissions.
- Every invocation asserts `PermissionV2` action `task` against the selected agent with parent assistant/tool source and description/agent metadata before child creation or resume.
- New children use deterministic Session and prompt IDs derived from parent Session, assistant message, and tool call. The V2-owned child persists parent, Location/project, title, selected agent, exact inherited or overridden model, and task ownership metadata.
- The persisted permission ceiling carries parent denies and external-directory restrictions. It is evaluated separately from child permissions and saved approvals, so child rules or approvals cannot weaken it. Nested `task` and `todowrite` default to deny unless the selected child agent configures them.
- Resume accepts only V2-owned task children with matching parent, project/Location, agent, and task-owner metadata. Arbitrary Session IDs and conflicting durable invocation/prompt identities return model-facing failures.
- `Task.Requested` durably records child Session/model and prompt identity before prompt admission or execution. `SessionInput.admit` makes prompt admission deterministic and idempotent.
- `Task.Execute` is process-local routing only. `SessionExecutionLocal` wakes and waits for the child coordinator, so provider and tool work remain in `SessionRunner`; no second executor or direct provider path exists.
- Parent `Tool.Progress` includes child Session, agent, and model linkage. Completion and failure return through the captured `ToolRegistry`, retaining stale-registration checks, generic output bounding, and CodeMode nesting.
- Startup discovers durable task requests and wakes the parent lane. A running parent task is rematerialized through its captured plan, reconnects to the deterministic child, reuses an admitted prompt, and returns terminal child output without another child execution.
- Parent interruption durably marks the task, routes interruption only to the child coordinator, waits for cleanup, and prevents an interrupted owned child from startup recovery.
- The result envelope is `<task id="..." state="completed"><task_result>...</task_result></task>`; empty child text is valid. The last non-empty assistant text after the deterministic child prompt wins.
- Harness `multiAgent` is carried in the immutable tool plan. Both `v2` and pinned Luna `v1` use this foreground V2 implementation while the selected version is persisted in the task request.

## RED Evidence

- The inherited H5C1 working tree's initial focused test command, `bun test test/tool-task.test.ts`, passed 7 tests.
- A strict-TDD catalog invariant was then added: caller-denied agents must not leak into unavailable-agent diagnostics.
- RED command from `packages/core`: `bun test test/tool-task.test.ts`.
- RED result: `7 pass`, `1 fail`; expected `Callable agents: general`, received `Callable agents: general, modeled`.
- A broader focused run later exposed an enumerable internal permission snapshot in existing Tool context equality and eager task-recovery materialization delaying established runner dispatch. Both were corrected before final verification.

## GREEN Evidence

- Focused Core command from `packages/core`: `bun test test/tool-task.test.ts test/tool-codemode.test.ts test/model-harness.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts`; `49 pass`, `0 fail`.
- Full Session runner command from `packages/core`: `bun test test/session-runner.test.ts`; `142 pass`, `0 fail`.
- Full Core command from `packages/core`: `bun test`; `1226 pass`, `0 fail`, `3415 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

## Files

- `packages/core/src/permission.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/projector.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/store.ts`
- `packages/core/src/session/task-metadata.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/builtins.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/src/tool/tool.ts`
- `packages/core/test/location-layer.test.ts`
- `packages/core/test/session-runner-tool-registry.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

## Commit

- Implementation and tests: `a639c86968 feat(session): add durable V2 subagent tasks`
- Report: recorded in the following documentation commit.
- Nothing was pushed.

## Self-Review

- The Location tool depends on lower Session store/input/event boundaries, not the top-level Session service, avoiding the documented `SessionV2 -> LocationServiceMap -> task -> SessionV2` cycle.
- Child execution and interruption route by Session ID through the existing keyed coordinator; unrelated Sessions are not addressed or interrupted.
- Durable request and interruption IDs are deterministic, prompt admission is conflict-checked, and terminal child output is checked before any execution signal.
- Permission ceilings are persisted with child ownership and evaluated independently of remembered approvals.
- Tool definitions, function settlement, CodeMode discovery/execution, stale registration, progress, and output retention all share one materialized registry capture.
- Materialized permission rules are frozen and available to canonical tools without changing the enumerable application-tool context shape.
- Recovery-only task scans remain off the forced provider-run fast path, preserving existing immediate and cross-Session runner concurrency.

## Concerns

- Startup task discovery scans durable task request events because H5C1 intentionally adds no migration or dedicated lifecycle table. A future indexed projection may be useful at very large event volumes.
- As with the existing authoritative Session lane, a process loss during an in-flight provider request cannot prove the remote provider did not execute; H5C1 guarantees deterministic local admission and avoids redispatch once terminal child output is durable.

## Review Rejection Fixes

### Findings Resolved

- Pending recovery: `failInterruptedTools` now recognizes both pending and running `task` projections. Pending JSON input is decoded and durably promoted through the ordinary Tool.Called transition before the captured ToolRegistry settles it. Running tasks retain the same registry path.
- Crash boundaries: deterministic child-only, requested-before-progress, admitted-before-execution, and terminal-child states all reconnect through one child identity. Existing prompt admission and terminal output are reused, and terminal recovery does not emit another child execution.
- Permission ceiling: task creation derives the ceiling only from the immutable materialized caller rules, persists only deny statements, and appends nested `task`/`todowrite` denies unless the selected child explicitly declares those exact actions. Live parent-agent reconstruction and persisted ask/allow rules were removed.
- Hard ceiling: PermissionV2 now treats any matching persisted ceiling deny as terminal before child rules or saved approvals. Rule ordering cannot turn a ceiling deny into allow.
- V2 creation boundary: `SessionCreate` and internal synchronized `SessionEvent.Created` now own canonical Session creation/projection. Normal SessionV2 creation and task child creation share it. `TaskTool` has no SessionV1 or BackgroundJob dependency; legacy V1 creation projection remains only for compatibility.
- Deterministic collision validation: an occupied deterministic child ID is validated for V2 runtime, parent, project, Location, agent, model, title, task owner/origin, and ceiling before request publication or prompt admission. Resume validates V2 ownership, parent, project, Location, agent, and task-owner compatibility.
- Real gates: SessionRunner reconnects pending and running canonical task calls; SessionExecutionLocal discovers a ready parent with durable task work; public Session interruption durably marks the task and waits for child cleanup signaling.
- Registry and harness gates: task-specific stale registration and output bounding are covered, and real runner settlement observes `multiAgent: v2` for GPT-5.6 and `multiAgent: v1` for Luna without entering V1 execution.

### Review RED Evidence

- Command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts`.
- Result before fixes: `185 pass`, `5 fail`, `576 expect()` calls. Failures reproduced V1 creation persistence, hard-ceiling override, live-agent ceiling reconstruction, unvalidated deterministic collision, and pending task generic failure.
- The first expanded execution gate additionally timed out because its fixture had a Task.Requested event without the required projected parent tool state. Seeding the real pending Tool.Input projection made the gate exercise production recovery and pass.

### Review GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `238 pass`, `0 fail`, `744 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1236 pass`, `0 fail`, `3451 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.
- Source check: `packages/core/src/tool/task.ts` contains no `SessionV1` or `BackgroundJob` reference.

### Review Files

- `packages/core/src/permission.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/create.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/projector.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/test/permission.test.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Review Commit

- Fixes and regressions: `a6078140d0 fix(session): harden V2 task recovery`
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Review Self-Review

- The internal V2 creation event is synchronized and replayable but intentionally excluded from the public Session event stream, preserving the prior API behavior while removing task's V1 implementation dependency.
- Concurrent creation still has one deterministic event/projector winner. Normal Session creation returns the existing projection as before; task creation performs strict post-race ownership validation.
- Pending recovery records Tool.Called before settlement, so Tool.Success/Failed uses the normal running-state transition and settles exactly once.
- Ceiling denies are checked independently with deny-any semantics in both initial assertions and remembered-approval reconciliation.
- The immutable caller snapshot, rather than mutable AgentV2 state, is the sole parent restriction source for newly persisted child metadata.
- Lifecycle tests count Task.Execute/provider work and prompt rows across child-only, requested, admitted, and terminal states; terminal retries do not execute again.
- Location/project/agent/task-owner conflicts are rejected before deterministic prompt admission.

### Review Concerns

- Durable task discovery still scans synchronized request events; this remains the intentional no-migration tradeoff from H5C1.
- Remote provider execution cannot be proven exactly once if the process dies while the request is in flight. Locally durable prompt admission and terminal recovery are exactly-once/idempotent, and no terminal child is redispatched.

## Re-Review Correctness Fixes

### Findings Resolved

- Public interruption now persists the parent interrupt barrier, durably marks each active task interrupted, routes and awaits child cleanup, and records one deterministic parent `Tool.Failed` terminal before cancelling the parent lane. Fiber cleanup observes the same durable marker and does not emit a second child signal.
- Child orphan detection now treats a parent `InterruptRequested` sequenced after the task's canonical origin request as an immediate recovery fence. Startup recovery therefore cannot execute a pending child in the crash window before `Task.Interrupted` is written.
- `Task.Requested` now persists the originating caller agent, immutable permission snapshot, complete materialized tool plan, project, Location, title, and ceiling. Runner recovery rematerializes and settles from that snapshot instead of mutable Session agent/model/harness state.
- Explicit `task_id` resume and recovered execution now require a deterministic child ID backed by the owner's canonical origin request and matching child, prompt, agent, model, project, Location, title, and ceiling identity. Schema-valid fabricated ownership metadata without that request is rejected before prompt admission.
- Recovery reconnects through the canonical `ToolRegistry` and `TaskTool` registration. Internal immutable plan/request context remains non-enumerable, preserving application-tool context shape, stale registration checks, generic output bounding, and CodeMode behavior.

### Re-Review RED Evidence

- Command from `packages/core`: `bun test test/session-create.test.ts test/session-execution-local.test.ts test/session-runner.test.ts test/tool-task.test.ts`.
- Before the fixes, regressions showed four expected failures: public interruption left the parent task running, a parent-only durable interrupt did not orphan the child, fabricated task metadata resumed without origin proof, and recovery used the mutated reviewer permissions and Luna `v1` plan instead of the originating snapshot.

### Re-Review GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `243 pass`, `0 fail`, `761 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1241 pass`, `0 fail`, `3468 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.
- Source check: `packages/core/src/tool/task.ts` contains no `SessionV1` or `BackgroundJob` reference.

### Re-Review Production Gates

- Public `SessionV2.interrupt` tests prove child cleanup is awaited, the child is durably orphaned, and the parent tool projects `Tool execution interrupted` terminally.
- `SessionExecutionLocal` starts with a recoverable pending child input behind only the parent interrupt barrier and proves the child runner is never invoked.
- `SessionRunnerLLM` proves a durable task rematerializes with the original caller agent, permissions, GPT-5.6 `v2` plan, and request identity after the parent Session and model catalog are changed to reviewer/Luna.
- Canonical `ToolRegistry` plus the real `TaskTool` reconnects a persisted request without another permission admission, prompt, or child execution.
- Resume validation rejects deterministic, schema-valid task metadata when its canonical origin request is absent.

### Re-Review Files

- `packages/core/src/session.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/src/tool/tool.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Re-Review Commit

- Fixes and production-path regressions: `10388db57b fix(session): close durable task recovery gaps`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Re-Review Self-Review

- Recovery does not consult the current parent agent, current permissions, or current model harness when a durable request snapshot exists.
- Parent interruption establishes the durable child recovery fence before any cancellation can trigger task-fiber cleanup, and parent terminal settlement follows awaited child cleanup.
- Origin proof is tied to deterministic parent/message/call IDs and all persisted child identity fields; arbitrary Session IDs and fabricated metadata remain model-facing conflicts.
- Task recovery still uses one captured registry registration and the authoritative child Session lane; no alternate provider or tool executor was introduced.

### Re-Review Concerns

- Durable task discovery and parent interrupt checks query synchronized events because H5C1 intentionally adds no lifecycle table or migration.
- A remote provider request interrupted before its response is durably recorded still cannot provide remote exactly-once proof; deterministic local admission and terminal recovery remain idempotent.

## Final Resume Correctness Fixes

### Findings Resolved

- A validated `task_id` resume now separates current invocation data from canonical child identity. The new request retains the current description, prompt, caller permission snapshot, permission admission, and plan, while project, Location, title, model, and ceiling remain those of the validated existing child and original owner request.
- Resume recovery therefore accepts changed descriptions and changed current caller permissions without weakening or rewriting the persisted child ceiling. The request's current permission snapshot remains available for exact recovery rematerialization.
- Child orphan detection validates every deterministic `Task.Requested` event targeting the canonical child and checks each corresponding interruption marker. An interrupted resume call now fences startup recovery even when the original owner call was not interrupted; parent `InterruptRequested` sequencing remains unchanged.
- The production recovery gate now registers the real canonical `TaskTool`, starts the real `SessionRunnerLLM` through `SessionExecutionLocal`, recovers an admitted resumed prompt, executes the child provider once, and terminally settles the parent task before its continuation turn.

### Final RED Evidence

- Command from `packages/core`: `bun test test/tool-task.test.ts test/session-execution-local.test.ts`.
- Result before fixes: `24 pass`, `2 fail`, `96 expect()` calls. The failures reproduced a changed-description resume request persisting a non-canonical title and a resumed-call interruption failing to orphan its pending child.

### Final GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `246 pass`, `0 fail`, `773 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1244 pass`, `0 fail`, `3480 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.
- Source check: `packages/core/src/tool/task.ts` contains no `SessionV1` or `BackgroundJob` reference.

### Final Production Gate

- The resumed task starts from a deterministic original child and a distinct durable resume request with a changed description and current deny snapshot.
- Startup uses `SessionExecutionLocal` with the actual `SessionRunnerLLM`; runner recovery materializes the actual scoped `TaskTool` registration and publishes `Task.Execute` through the normal event listener.
- The child provider sees the resumed prompt exactly once, the parent tool reaches completed state with the child result, and the parent continuation runs afterward.

### Final Files

- `packages/core/src/session/task.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Final Commit

- Fixes and production-path regressions: `1bb05dfa02 fix(session): harden resumed task recovery`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Final Self-Review

- Resume calls cannot replace immutable child ownership fields with description-derived or current-permission-derived values.
- Canonical request matching includes deterministic event/prompt IDs plus child, parent, agent, model, project, Location, title, and ceiling identity before an interruption can orphan the child.
- Public parent interruption behavior is preserved, while ordinary interruption of any valid resume call now blocks child restart.
- The integrated gate contains no replacement task definition and performs no direct registry settlement.

### Final Concerns

- Orphan evaluation scans the parent's durable task requests because H5C1 intentionally adds no task lifecycle index or migration.
- Remote provider work interrupted before durable response recording still cannot provide remote exactly-once proof; local admission, recovery, and terminal settlement remain deterministic.

## Final Ordering Fixes

### Findings Resolved

- `SessionTask.cancelled` now recognizes either the deterministic task interruption marker or a parent `InterruptRequested` sequenced after the task request. Runner recovery uses this shared barrier before task rematerialization and writes the deterministic interrupted parent `Tool.Failed` terminal without dispatching the child.
- `TaskTool` checks the canonical child orphan fence before terminal reuse/admission, immediately after admission and before `Task.Execute`, and again after the process-local execute signal. An interruption winning any boundary returns `Tool execution interrupted` instead of child output or a missing-terminal error.
- `SessionExecutionLocal` independently rechecks the canonical orphan fence inside the live `Task.Execute` listener immediately before coordinator wake, closing the race between TaskTool's check and event delivery.
- New task calls now persist the complete immutable `Task.Requested` snapshot before deterministic child creation. Child creation consumes request-equivalent identity, and child-only state without a durable immutable request is rejected rather than reconstructed from current mutable agent/model/harness state.
- Recovery from request-before-child validates that the request owns the deterministic origin child, creates it exactly once from request agent/model/project/Location/title/ceiling, then uses deterministic prompt admission. Resume requests still require their existing original child.

### Ordering RED Evidence

- Command from `packages/core`: `bun test test/tool-task.test.ts test/session-execution-local.test.ts -t "immediately after prompt admission|live Task.Execute listener"`; `0 pass`, `2 fail`, `2 expect()` calls. TaskTool emitted through the admission-time interruption and the local listener woke an already orphaned child.
- Command from `packages/core`: `bun test test/tool-task.test.ts -t "missing child from the immutable request"`; `0 pass`, `1 fail`, `1 expect()` call. Recovery returned an error because it assumed the child already existed.
- Command from `packages/core`: `bun test test/session-runner.test.ts -t "settles parent interruption before recovered task"`; `0 pass`, `1 fail`, `1 expect()` call. The child provider was invoked through a durable parent interrupt barrier.

### Ordering GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `252 pass`, `0 fail`, `790 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1250 pass`, `0 fail`, `3497 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.
- Source check: task production files contain no `SessionV1`, `BackgroundJob`, `any`, or `never` escape.

### Ordering Production Gates

- A recoverable pending/running parent task with `InterruptRequested` but no `Task.Interrupted` starts through real `SessionExecutionLocal`, `SessionRunnerLLM`, and canonical `TaskTool`; the child provider count remains zero and the parent projects `Tool execution interrupted`.
- An admission listener durably completes task cleanup immediately before `Task.Execute`; the full production stack emits no execute signal, invokes no child provider, and terminally fails the parent as interrupted.
- Request-before-child recovery runs through the full stack after parent agent/model, reviewer permissions, and harness mutate to Luna. It creates the child from the original request snapshot, admits one prompt, executes one child provider turn, and terminally settles the parent.
- Child-created resumed recovery repeats the same mutable parent changes and still uses the original caller permissions and `v2` plan with one child provider execution.
- A direct local listener race publishes `Task.Execute` only after durable interruption and proves the second fence independently suppresses coordinator wake.

### Ordering Files

- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Ordering Commit

- Fixes and production-path regressions: `87ddec0a3d fix(session): close task ordering races`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Ordering Self-Review

- Every task-owned child wake now has both a producer-side and consumer-side durable fence.
- Parent recovery interruption settlement uses a deterministic event ID shared with public interruption, keeping concurrent/repeated recovery idempotent.
- Request-first creation removes the only new-child state that lacked caller permissions and tool-plan snapshots; unsupported legacy child-only state fails closed.
- Request-before-child and child-created tests mutate all current resolution inputs and verify recovery never consults them.

### Ordering Concerns

- Canonical orphan evaluation still scans parent task requests because H5C1 intentionally introduces no lifecycle index or migration.
- Remote provider execution already in flight before a durable interruption remains outside local exactly-once guarantees; all local wake and admission boundaries are now fenced.

## Final Recovery Edge Cases

### Findings Resolved

- `SessionTask.cancelled` now falls back from a missing `Task.Requested` to the durable parent task call's first projection sequence. A later parent `InterruptRequested` therefore terminally fails pending recovery before request creation, child creation, or dispatch.
- Child ceilings now persist parent denies plus `external_directory` ask/deny restrictions. Ceiling denies use independent matching, and matching external-directory asks force a fresh ask before child rules or saved approvals can allow the operation.
- Permission replies still authorize the current blocked invocation, but remembered approvals cannot auto-resolve a later invocation governed by an external-directory ask ceiling.
- A `task_id` resume merges the persisted child ceiling with current parent restrictions, removes only exact duplicates, and persists the strengthened owner metadata before request publication or prompt admission. The resumed request snapshots that effective ceiling.
- Canonical ownership and orphan validation now accept historical request ceilings only when they are subsets of the current persisted ceiling, preserving request-chain identity while allowing monotonic strengthening.
- Startup recovery rechecks the canonical orphan fence after pending reads and immediately before each first or coalesced wake. The coordinator drain performs a final authoritative orphan check before invoking the runner.

### Edge RED Evidence

- Baseline command from `packages/core`: `bun test test/session-runner.test.ts -t "pending task interrupted before its durable request"`; `0 pass`, `1 fail`, `3 expect()` calls. Real runner recovery entered task execution and left the parent running instead of terminally settling `Tool execution interrupted`.
- Baseline command from `packages/core`: `bun test test/permission.test.ts -t "external-directory ceiling asks"`; `0 pass`, `1 fail`, `1 expect()` call. Child allow plus a saved approval weakened the ceiling ask to allow.
- Baseline command from `packages/core`: `bun test test/tool-task.test.ts -t "monotonically strengthens"`; `0 pass`, `1 fail`, `2 expect()` calls. Resume retained only the original task/todowrite denies and omitted the new parent external-directory ask and edit deny.
- Baseline command from `packages/core`: `bun test test/session-execution-local.test.ts -t "between startup pending reads"`; `0 pass`, `1 fail`, `4 expect()` calls. Interruption committed during pending-state discovery still allowed the child runner wake.

### Edge GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `255 pass`, `0 fail`, `801 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1253 pass`, `0 fail`, `3508 expect()` calls across 140 files.
- The first final full Core rerun reported one unrelated `does not bump the runtime epoch when a non-forced drain has no work` failure (`1252 pass`, `1 fail`); its isolated rerun passed (`1 pass`, `0 fail`, `2 expect()` calls), and the subsequent full rerun produced the clean result above.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

### Edge Production Gates

- Real `SessionExecutionLocal` and `SessionRunnerLLM` recovery of a callable, permitted pending task with no request observes the parent interrupt from the tool-call sequence, creates no durable request, sends no child provider request, and projects `Tool execution interrupted`.
- A child external-directory allow and matching saved approval cannot weaken a persisted matching ask; replying `always` releases the current assertion while the next assertion asks again.
- Resume after adding parent restrictions persists the merged child owner ceiling and current request ceiling, then replays that request through canonical `TaskTool` materialization without duplicate child provider execution.
- Existing permission coverage independently proves a persisted child ceiling deny wins over child allow and saved approval.
- The deterministic startup race commits `Task.Interrupted` from the final pending-state read; startup records the race and orphan state while child runner/provider count remains zero.

### Edge Files

- `packages/core/src/permission.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/test/permission.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Edge Commits

- Fixes and regressions: `dda873588f fix(session): close task recovery edge cases`.
- Strengthened real-runner fixture: `997f14da23 test(session): exercise pre-request task dispatch`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Edge Concerns

- Cancellation fallback scans the parent task-call projection events only when the deterministic immutable request does not exist; normal request-based sequencing remains the primary path.
- Ceiling revisions are monotonic restrictions by construction and intentionally have no weakening/removal path in H5C1.

## Final Durability And Concurrency Fixes

### Findings Resolved

- `SessionTask.strengthen` now reads, unions, and persists child owner ceilings inside an immediate database transaction. Competing resume revisions serialize against the latest committed metadata, so neither invocation can overwrite a stronger concurrent ceiling.
- Resume requests snapshot the effective ceiling returned by their atomic revision. Canonical request-chain checks continue to accept an earlier request only when every historical rule is present in the final child ceiling.
- The runner now durably publishes deterministic `Task.Prepared` before publishing any task input/call projection. The snapshot owns caller agent, materialized permissions, tool/multi-agent plan, selected input/agent/model/availability, parent origin, project/Location/title, and derived ceiling.
- Startup discovery includes prepared sessions. A prepared snapshot with no projected pending/running call wakes no runner work and is harmless.
- Pending/running task recovery without `Task.Requested` now requires and materializes only the prepared permissions and plan. It passes the prepared caller and identity into canonical TaskTool admission and never resolves the current parent agent, model, catalog, or harness.
- Permission assertions can evaluate an invocation-owned immutable ruleset, including after the originating agent permissions mutate.
- Parent external-directory ask extraction now uses wildcard action matching in both live preparation and direct TaskTool admission.

### Durability RED Evidence

- Baseline command from `packages/core`: `bun test test/tool-task.test.ts -t "serializes competing persisted ceiling revisions"`; `0 pass`, `1 fail`. The deterministic atomic revision API did not exist (`SessionTask.strengthen is not a function`).
- Baseline command from `packages/core`: `bun test test/tool-task.test.ts -t "monotonically strengthens"`; `0 pass`, `1 fail`, `2 expect()` calls. A wildcard `*` external-directory ask was omitted from the persisted child ceiling.
- Baseline command from `packages/core`: `bun test test/session-runner.test.ts -t "preparation before projecting a live task call"`; `0 pass`, `1 fail`. No durable prepared snapshot existed (`SessionTask.prepared is not a function`).
- Baseline command from `packages/core`: `bun test test/session-runner.test.ts -t "pre-request task only from its immutable prepared snapshot"`; `0 pass`, `1 fail`. No deterministic prepared event identity existed (`SessionTask.preparedEventID is not a function`).

### Durability GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `259 pass`, `0 fail`, `814 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1257 pass`, `0 fail`, `3521 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

### Durability Production Gates

- Two concurrent real `task_id` settlements add distinct parent denies, preserve both in child metadata, record request ceilings that are subsets of the final union, and replay both requests through canonical TaskTool without duplicate child work.
- Two concurrent direct persisted revisions independently prove the transaction helper converges to both restrictions.
- A live provider task call proves the deterministic prepared event sequence precedes the first projected task input sequence.
- Prepared-only restart recovery mutates the parent agent/model/permissions, removes the selected subagent from the current catalog, and switches the harness to Luna; recovery still creates one deterministic child and records the original caller, permissions, plan, selected agent/model, and ceiling.
- Existing child allow and saved-approval coverage now uses a wildcard-action external-directory ask, while TaskTool resume coverage proves that wildcard restriction is persisted.

### Durability Files

- `packages/core/src/permission.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/projector.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/src/tool/tool.ts`
- `packages/core/test/permission.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/tool-task.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Durability Commits

- Implementation and production regressions: `b9c691c875 fix(session): preserve durable task preparation`.
- Deterministic convergence gate: `fa56416d1e test(session): lock task ceiling convergence`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Durability Concerns

- Prepared snapshots are durable per task call and intentionally remain harmless audit records when a crash occurs before any call projection.
- Ceiling strengthening is monotonic by design; H5C1 provides no restriction-removal operation.

## Final Localized Durability Gaps

### Localized Findings Resolved

- Public `SessionV2.interrupt` now recognizes a canonical prepared pending/running task even when `Task.Requested` does not exist. It publishes the deterministic parent `Tool.Failed` terminal before runner cancellation and emits no child interruption event when no child exists.
- Repeated and concurrent public interrupts converge on the same deterministic parent tool terminal.
- Task progress now has a deterministic event identity and request-derived payload. Normal execution and request recovery share one publisher that reuses a compatible existing linkage, verifies child/agent/model identity, tolerates a duplicate publication race, and rejects incompatible state.
- Request-before-progress recovery restores durable child linkage before prompt execution and terminal settlement.
- Tool materialization now clones and freezes every permission rule object plus the containing array. The exact frozen materialized snapshot is exposed through tool context and persisted by `Task.Prepared`; filtering and ceiling derivation use that same snapshot.

### Localized RED Evidence

- Command from `packages/core`: `bun test test/session-create.test.ts -t "prepared task before its request"`; `0 pass`, `1 fail`, `3 expect()` calls. Concurrent public interrupts left the prepared task projection pending.
- Command from `packages/core`: `bun test test/session-runner.test.ts -t "pre-request task only from its immutable prepared snapshot"`; `0 pass`, `1 fail`, `4 expect()` calls. Request recovery had no deterministic progress event (`SessionTask.progressEventID is not a function`).
- Command from `packages/core`: `bun test test/session-runner-tool-registry.test.ts -t "deep-freezes cloned materialized"`; `0 pass`, `1 fail`, `1 expect()` call. The malicious tool changed the captured rule from deny to allow.

### Localized GREEN Evidence

- Focused command from `packages/core`: `bun test test/permission.test.ts test/tool-task.test.ts test/session-create.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-runner-tool-registry.test.ts test/tool-codemode.test.ts test/model-harness.test.ts`; `261 pass`, `0 fail`, `822 expect()` calls.
- Full Core command from `packages/core`: `bun test`; `1259 pass`, `0 fail`, `3529 expect()` calls across 140 files.
- Full CodeMode command from `packages/codemode`: `bun test`; `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

### Localized Production Gates

- Two concurrent public interruption calls immediately terminally project a prepared-only task as `Tool execution interrupted`, create no `Task.Requested` or `Task.Interrupted`, and persist one deterministic `Tool.Failed` event without resume/restart.
- Prepared-only request recovery creates the deterministic child, restores exactly one durable progress event containing child session, original agent, and original model linkage, then reaches the expected terminal child result.
- Repeated normal and recovered TaskTool settlement reuses the compatible progress event; the full TaskTool suite proves no duplicate event conflict or duplicate child work.
- A malicious registered tool attempts `Reflect.set` on its captured rule. Mutation returns false, the cloned rule remains deny, the caller's source rule remains deny, and later materialization still filters the denied target.

### Localized Files

- `packages/core/src/session.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/task.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/src/tool/task.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-runner-tool-registry.test.ts`
- `packages/core/test/session-runner.test.ts`
- `.superpowers/sdd/task-h5c1-report.md`

### Localized Commits

- Fixes and regressions: `07bcb61404 fix(session): close task durability gaps`.
- Report: recorded in the following documentation commit.
- Nothing was pushed.

### Localized Concerns

- Prepared-only interruption intentionally records only the parent terminal because no child identity has been materialized yet.
- Progress identity is immutable per task invocation; incompatible pre-existing linkage fails closed instead of being overwritten.
