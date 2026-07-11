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
