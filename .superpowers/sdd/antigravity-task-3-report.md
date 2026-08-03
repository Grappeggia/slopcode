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
