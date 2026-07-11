# Task H5B2 Report

## Status

Complete with known unrelated Slopcode typecheck failures. Foreground V2 shell commands are durably admitted, serialized through the authoritative Session execution lane, bounded by the shared Bash process boundary, restart-safe against duplicate spawn, and optionally followed by a durable provider continuation.

## Lifecycle Design

- `Shell.Requested` records `SessionMessage.ID`, command, normalized resume intent, and aggregate admission sequence before the execution lane is woken.
- Request, started, terminal, and continuation-complete event IDs are deterministic from the message ID. Exact retries observe the original request/terminal; a different command, resume value, session, prompt, compaction, or projected message conflicts.
- A request without `Started` is safe to execute. `Started` is published through the runtime epoch fence immediately before the shared process boundary calls `AppProcess.run`.
- A persisted `Started` without terminal is conservatively settled as `unknown` during recovery and is never spawned again. Any terminal prevents another spawn.
- `Shell.Ended` v2 stores status, bounded output, optional exit code, and truncation metadata. The retained v1 decoder and optional projected fields keep old shell rows replayable.
- Timeout, spawn failure, interruption, and restart-unknown use deterministic safe output. Non-zero exit is a normal `completed` result with its exit code.
- Process execution uses the Session Location directory, configured shell or platform fallback, ignored stdin, detached POSIX process groups, three-second force kill, 120000 ms timeout, and independent 1 MiB stdout/stderr bounds.
- `packages/core/src/shell.ts` is the canonical configured-shell/process/output boundary. Model Bash keeps permission checks and workdir authorization before calling it; operator shell calls it directly and creates no model permission request.
- Process execution is interruptible so scoped `AppProcess` cleanup runs. Terminal settlement remains masked and first attempts the active runtime epoch fence; fence loss falls back to a raw interrupted terminal so the command cannot be retried.
- `resume: false` ends at the shell terminal with no provider request. `resume: true` leaves durable continuation work until one provider/tool continuation chain completes and `Shell.Continued` is recorded.
- `SessionV2.shell` waits on its deterministic terminal event, not coordinator idleness, so later coalesced prompts do not delay the shell caller.
- Startup recovery unions paused runtime recovery with V2-owned sessions discovered from pending shell requests, including requests admitted while runtime state is still `ready`.
- `SessionControl.shell` checks V2 ownership before admission. An ownership race after admission settles the request without publishing `Started` or spawning.

## RED Evidence

- Command: `bun test test/session-runner.test.ts --timeout 30000` from `packages/core`.
- Result before implementation: `125 pass`, `6 fail`; foreground result, timeout/spawn failure, idempotency, resume, interruption, and restart-unknown tests failed against `Session.OperationUnavailableError` or missing `SessionInput.admitShell`. The interruption test timed out because no process was started.
- First full Core run exposed the new runner dependency missing only from the recorded runner fixture: `1207 pass`, `1 fail`, `Service not found: @slopcode/AppProcess`.
- The fixture was updated with the same real `AppProcess.defaultLayer` dependency used by production Location services; its focused replay test then passed.

## GREEN Evidence

- `bun test test/session-runner.test.ts test/session-execution-local.test.ts test/session-projector.test.ts test/session-create.test.ts test/session-runner-recorded.test.ts test/tool-bash.test.ts --timeout 30000` from `packages/core`: `198 pass`, `0 fail`.
- `bun test test/tool-bash.test.ts --timeout 30000` from `packages/core`: `19 pass`, `0 fail`.
- `bun test test/session-runner-recorded.test.ts --timeout 30000` from `packages/core`: `1 pass`, `0 fail`.
- `bun test --only-failures` from `packages/core`: `1208 pass`, `0 fail`, `3345 expect()` calls across `138` files.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `bun run typecheck` from `packages/slopcode`: H5B2's legacy `Shell.Ended` schema error was fixed; two pre-existing failures remain at `src/session/processor.ts:495` and `test/v2/session-message-updater.test.ts:168`.
- `bun oxlint <17 changed source/test files>` from the repository root: `0 errors`, `94 warnings` (the touched large files already contain warning-level findings).
- `git diff --check`: passed.

## Files Changed

- `packages/core/src/shell.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/control.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/input.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/message.ts`
- `packages/core/src/session/projector.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/tool/bash.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-execution-local.test.ts`
- `packages/core/test/session-projector.test.ts`
- `packages/core/test/session-runner-recorded.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/slopcode/src/session/prompt.ts`
- `.superpowers/sdd/task-h5b2-report.md`

## Commit

- Implementation: `81729f077e feat(session): add durable foreground V2 shell`
- Nothing was pushed.

## Self-Review

- No shell process is launched from the Session/API caller fiber; only the runner-owned Location lane calls the canonical process boundary.
- `Started` publication and process spawn are ordered in one Effect chain. Once `Started` may exist, every recovery path refuses to rerun the command.
- The exact terminal stream is subscribe-before-replay and scoped to one deterministic event ID, avoiding fast-terminal races and unrelated prompt waits.
- Process cleanup remains owned by scoped `AppProcess`; shell-specific code does not duplicate spawner or kill logic.
- Operator shell does not enter `PermissionV2`; model-facing Bash retains parser, external-directory, and Bash permission checks.
- Old v1 shell terminals continue to decode/project, while new v2 rows round-trip status, exit, and truncation metadata.
- Ready-state recovery, started-unknown recovery, exact ended retry, continuation recovery, interruption, epoch loss, concurrent commands, prompt ordering, V1 ownership, and missing Session control all have focused coverage.
- Repository search finds no `OperationUnavailableError` or stale `move`/`shell` unavailable union.

## Concerns

- Pending shell lifecycle discovery scans synchronized shell request events because H5B2 does not add a migration/projection table. Deterministic IDs and existing event indexes bound individual lookups, but a future migration may be warranted at high history volume.
- Shell spawn is exactly-once-conservative; provider continuation remains recoverable/at-least-once. A crash after provider dispatch but before `Shell.Continued` can retry the provider continuation, but never the shell command.
- Slopcode typecheck still has the two unrelated pre-existing failures listed above.

## Review Fixes

### Findings Resolved

- Started/terminal race: shell admission is still committed by EventV2's immediate transaction, while `Started` and `Ended` now add expected-state commit guards inside that same transaction. A pre-start terminal requires no `Started`; `Started` requires no terminal; a post-start terminal requires `Started`. A losing `startShell` returns `false`, and the canonical process callback treats that as a lost claim without spawning.
- Epoch loss before spawn: failure of the fenced `Started` commit settles only through the guarded requested-state terminal. If another runner won `Started`, that terminal loses instead, so no terminal can precede a later `Started`/spawn.
- Continuation redispatch: `Shell.ContinuationStarted` is durably fenced immediately before `llm.stream`. It is a one-winner transition. Recovery of a started continuation writes `Shell.ContinuationUnknown` and never calls the provider again; `Shell.Continued` and unknown settlement are transactionally exclusive.
- Mixed recovery: startup now emits a coalesced successor wake whenever more than one durable work class is pending. The real runner also drains pending compaction after recovered shell work before returning.
- Legacy events: version-refined v1 and v2 `Shell.Ended` schemas are both included in `SessionEvent.Durable`/`All`, restoring v1 rows to `SessionV2.events()` while retaining typed v2 metadata.
- Startup scan: `pendingShellSessions()` now reads requests once, reads relevant terminal lifecycle events once, and groups pending Session IDs in memory instead of rereading complete Session history for every request.

### Review RED Evidence

- Command: `bun test test/session-shell-lifecycle.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-projector.test.ts --timeout 30000` from `packages/core`.
- Result before review fixes: `155 pass`, `6 fail`.
- The failures reproduced the terminal-plus-Started double commit, duplicate continuation dispatch gap, shell-plus-compaction single-wake strand, missing v1 terminal in the public event stream, and epoch-loss-before-spawn settlement mismatch.

### Review GREEN Evidence

- `bun test test/session-shell-lifecycle.test.ts test/session-runner.test.ts test/session-execution-local.test.ts test/session-projector.test.ts test/session-create.test.ts test/session-runner-recorded.test.ts test/tool-bash.test.ts --timeout 30000` from `packages/core`: `204 pass`, `0 fail`, `651 expect()` calls.
- `bun test --only-failures` from `packages/core`: `1214 pass`, `0 fail`, `3372 expect()` calls across `139` files.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `bun run typecheck` from `packages/slopcode`: only the two pre-existing unrelated failures remain at `src/session/processor.ts:495` and `test/v2/session-message-updater.test.ts:168`.
- `bun oxlint <11 review-fix source/test files>` from the repository root: `0 errors`, `96 warnings` from existing warning-level rules in the touched large files.
- `git diff --check`: passed.

### Review Commit

- `f0e668afc8 fix(session): harden durable shell recovery`
- Nothing was pushed.

### Review Self-Review

- The transition guards run after projection but before event insertion inside one immediate transaction; any failed guard rolls back both projection and lifecycle event.
- A terminal already committed before `Started` makes the start claim fail, and `ShellCommand.run` never reaches `AppProcess.run`. A committed `Started` makes requested-state failure settlement lose.
- The continuation marker is after all rebuildable context/model preparation and immediately before provider stream construction. Crashes on either side of dispatch are deliberately indistinguishable after the marker and settle unknown without redispatch.
- Normal continuation completion, conservative unknown settlement, and duplicate continuation starts each have deterministic IDs and mutually exclusive transaction guards.
- The original report's provider at-least-once continuation concern is superseded: H5B2 now guarantees at most one durable continuation start and no provider redispatch after that marker. Provider completion still cannot be proven externally without provider idempotency, so post-marker recovery reports unknown.
- The canonical shell/Bash process boundary was not changed by the review fixes; its focused tests remain green.
