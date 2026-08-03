# Task 3 — Antigravity interactive/agentic session behavior

## Delivered

- Added an Antigravity-specific headless-session notice: the `agy --print` bridge supports prompts and text output only, not structured tool or approval events.
- Added the Diagnostics **Open Interactive CLI** handoff and the PTY **Return to agentic session** action. Handoffs stop the orchestrator and close its wire before entering PTY mode; returning cleans only the active PTY channel and retains the SSH connection/workspace.
- Added explicit stopped, reconnect, retry, and setup-failure copy. The stopped state requires reconnect before retry, avoiding a request against a deliberately closed bridge.
- Extended the real-agent SSH harness with `antigravity-cli`, mapped it to protocol ID `antigravity`, and documented that it requires real remote credentials/service access.
- Extended deterministic Antigravity bridge coverage to assert adapter close lifecycle. No test invokes a real model service.

## Files

- `packages/android/src/index-app.tsx`
- `packages/android/src/ssh-agentic-session.tsx`
- `packages/android/src/ssh-session.tsx`
- `packages/android/src/ssh-session-flow.ts`
- `packages/android/src/ssh-session-flow.test.ts`
- `packages/android/src/source-regression.test.ts`
- `packages/android/app/src/main/java/dev/slopcode/android/SshTransport.kt`
- `packages/android/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`
- `packages/android/app/src/androidTest/java/dev/slopcode/android/SshTransportInstrumentedTest.kt`
- `packages/android/scripts/run-ssh-e2e-all-agents.sh`
- `packages/slopcode/test/remote-orchestrator.test.ts`

## Validation

| Command | Result |
| --- | --- |
| `bun test src/ssh-session-flow.test.ts src/ssh-orchestrator.test.ts src/source-regression.test.ts` (packages/android) | Pass — 9 tests |
| `bun test src` (packages/android) | Pass — 79 tests |
| `bun run typecheck` (packages/android) | Pass |
| `bun test test/remote-orchestrator.test.ts` (packages/slopcode) | Pass — 16 tests, deterministic fixture only |
| `bun run typecheck` (packages/slopcode) | Pass |
| `./gradlew :app:testDebugUnitTest` (packages/android) | BUILD SUCCESSFUL |
| `bun run build` (packages/android) | Web build and `:app:assembleDebug` successful |
| `git diff --check` | Pass |

The web build reports pre-existing Vite chunk-size/dynamic-import warnings but exits successfully. Android compilation reports the existing deprecated JSch `setPassword` warning.

## Self-review

- Confirmed direct native SSH enters the agentic screen after workspace setup and preserves the same in-memory workspace while switching views.
- Confirmed the orchestrator is stopped before its event wire closes and before PTY handoff; a failed stop leaves the agentic view active.
- Confirmed PTY cleanup is intentionally narrower than explicit disconnect, so returning to agentic does not discard the SSH connection.
- Confirmed Antigravity’s UI does not claim native approvals/tool events and the test path uses the deterministic fake CLI fixture.
- Confirmed the excluded `artifacts/android-ssh-flow/index.html` change remains uncommitted and untouched.

## Concerns

- Live Android SSH E2E was not run: `SSH_KEY_FILE`, `SSH_HOST`, and `SSH_USER` for the disposable fixture were not configured. The harness remains explicitly real-agent and does not claim a fake or successful live model turn.

## Review blocker fix

### Root cause and fix

The successful Stop transition previously changed only the phase. It left the old bridge wire, session ID, and turn ID available, and neither submission nor retry treated `stopped` as terminal. This could send a stale frame after Stop.

- Stop now clears `wireState` and resets orchestrator state to `stopped`, retaining only `lastPrompt`.
- `canSubmit()` and `canRetry()` now reject `stopped`; `send()`, `retry()`, and the prompt controls use these guards.
- Reconnect still starts a new wire/session, after which normal submission and retry are available.
- `ssh-session-flow.test.ts` now deterministically verifies that stopped sessions cannot submit or retry.

### Exact validation output

```text
$ bun test src/ssh-session-flow.test.ts
4 pass
0 fail
8 expect() calls
Ran 4 tests across 1 file.

$ bun test src && bun run typecheck
80 pass
0 fail
386 expect() calls
Ran 80 tests across 12 files.
$ tsgo --noEmit

$ ./gradlew :app:testDebugUnitTest
BUILD SUCCESSFUL in 469ms
24 actionable tasks: 24 up-to-date

$ bun test test/remote-orchestrator.test.ts && bun run typecheck
16 pass
0 fail
102 expect() calls
Ran 16 tests across 1 file.
$ tsgo --noEmit

$ bunx prettier --write src/ssh-session-flow.ts src/ssh-session-flow.test.ts src/ssh-agentic-session.tsx
src/ssh-session-flow.ts 31ms (unchanged)
src/ssh-session-flow.test.ts 10ms
src/ssh-agentic-session.tsx 62ms (unchanged)

$ bun run build:web
✓ built in 14.45s

$ git diff --check && git diff --cached --check
(no output; pass)
```

## Second review blocker fix

### Root cause and fix

Reconnect previously called `start()` without the stopped/error state's retained prompt. Startup then reset the state to its initial value, so the fresh ready session had no `lastPrompt` and could not present the retry action.

- Reconnect captures `lastPrompt` before closing the stopped bridge and passes it into startup.
- Startup seeds the new opening/ready state with that prompt while creating a fresh wire and session ID.
- Retry now requires a non-stopped phase plus the fresh session ID and wire; the ready view exposes **Retry last request** only after those are present.
- The deterministic session-flow test passes `review the diff` through reconnect and asserts retry is available only with a fresh ready session/wire.

### Exact validation output

```text
$ bun test src/ssh-session-flow.test.ts
5 pass
0 fail
10 expect() calls
Ran 5 tests across 1 file.

$ bun test src && bun run typecheck
81 pass
0 fail
388 expect() calls
Ran 81 tests across 12 files.
$ tsgo --noEmit

$ ./gradlew :app:testDebugUnitTest
BUILD SUCCESSFUL in 486ms
24 actionable tasks: 24 up-to-date

$ bun test test/remote-orchestrator.test.ts && bun run typecheck
16 pass
0 fail
102 expect() calls
Ran 16 tests across 1 file.
$ tsgo --noEmit

$ bunx prettier --write src/ssh-session-flow.ts src/ssh-session-flow.test.ts src/ssh-agentic-session.tsx
src/ssh-session-flow.ts 39ms (unchanged)
src/ssh-session-flow.test.ts 12ms (unchanged)
src/ssh-agentic-session.tsx 61ms

$ bun run build:web
✓ built in 13.09s

$ git diff --check && git diff --cached --check
(no output; pass)
```
