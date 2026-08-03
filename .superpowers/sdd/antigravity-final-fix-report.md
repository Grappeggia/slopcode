# Antigravity final review fix report

## Status

Complete on feature base `573fa687e0`. The final review findings were implemented as one coherent fix wave. The pre-existing `artifacts/android-ssh-flow/index.html` change was not edited or staged; its diff fingerprint remained `9e448a8836531de14c51aa7709cd14a1a9c815aa394c5a0f3636f6923864b962` before and after the work.

No publishing/release workflow, QR scanning, legacy HTTPS/desktop relay integration, or screenshot-gallery code was changed.

## Implemented fixes

### Canonical native SSH workspace binding

- Added the typed `sshSelectWorkspace` Android bridge operation and `SshTransport.selectWorkspace()` contract.
- Folder selection now calls the native operation before version/authentication checks and before workspace persistence. The UI stores and uses the canonical path returned by native code.
- Native selection resolves the requested path with SFTP `realpath`, validates it with SFTP `stat`, requires a non-root directory, and binds the canonical path to the active SSH connection.
- Disconnect/reconnect clears the binding. Version checks, auth checks, install/login setup, one-shot execution, interactive PTY execution, and orchestrator startup all require an exact match with the bound canonical path.
- Browsing remains navigable independently. Unbound, root, traversal, sibling, child, symlink-alias/escape, and stale post-reset execution paths are rejected instead of widening scope.

### Native orchestrator channel and startup lifecycle

- The TypeScript orchestrator wire now has an explicit native channel scope.
- Startup subscribes before native launch, scopes the wire immediately from the returned native ID, and only then sends workspace/session frames.
- Output, error, completion, and response frames from stale channel IDs are ignored. Deterministic coverage proves stale failures cannot reject a current pending request and stale output cannot reach the active session.
- After a native start succeeds, workspace/session startup failures clear wire state, close pending requests, stop the native orchestrator, and only then surface the original startup error.

### Antigravity CLI compatibility and authentication evidence

- Stream mode remains fixed argv: `agy --print --output-format stream-json -- <prompt>`.
- Only an explicit unsupported option/argument pattern in stderr permits one retry. The fallback is fixed argv: `agy --print -- <prompt>`.
- Both launches use `spawn` with `shell: false`; prompts remain one argv value after `--`. Missing binaries, network errors, timeouts, and other arbitrary failures are not retried.
- Added a deterministic fake child that validates both complete argv vectors, rejects stream-json with the explicit unsupported-option message, and succeeds in text mode. A separate test proves an arbitrary failure launches only once.
- `agy models` remains the fixed non-generative authentication probe. The parser now explicitly rejects sign-in output, including `Error: Please sign in to view available models. Launch the CLI without arguments to sign in.`, even if a model-looking line is also present.
- Review evidence supplied for the local Antigravity CLI: version 1.1.9 supports stream-json; authenticated `agy models` exits 0 and lists model IDs; an isolated signed-out HOME exits 1 with the exact sign-in message above. No model request was made during this fix wave.

### Interactive and retry UX

- Antigravity's **Open Interactive CLI** handoff enters and automatically starts the interactive PTY path. Other agents retain the existing one-shot-first behavior.
- Interactive startup reselects/verifies the persisted canonical workspace before preflight.
- Every **Retry last request** rendering path now requires both a live session ID and a live wire.
- Existing stop, disconnect, PTY cleanup, reconnect, and return-to-agentic behavior remains intact.

## Files changed

### Android native and native tests

- `packages/android/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`
- `packages/android/app/src/main/java/dev/slopcode/android/SshModels.kt`
- `packages/android/app/src/main/java/dev/slopcode/android/SshTransport.kt`
- `packages/android/app/src/test/java/dev/slopcode/android/SshModelsTest.kt`
- `packages/android/app/src/androidTest/java/dev/slopcode/android/SshTransportInstrumentedTest.kt`

### Android typed bridge, UI, lifecycle, and tests

- `packages/android/src/bridge.ts`
- `packages/android/src/bridge.test.ts`
- `packages/android/src/ssh.ts`
- `packages/android/src/ssh.test.ts`
- `packages/android/src/ssh-connect.tsx`
- `packages/android/src/ssh-orchestrator.ts`
- `packages/android/src/ssh-orchestrator.test.ts`
- `packages/android/src/ssh-agentic-session.tsx`
- `packages/android/src/ssh-session-flow.ts`
- `packages/android/src/ssh-session-flow.test.ts`
- `packages/android/src/ssh-session.tsx`
- `packages/android/src/source-regression.test.ts`

### Remote orchestrator and tests

- `packages/slopcode/src/remote-orchestrator/cli.ts`
- `packages/slopcode/test/remote-orchestrator.test.ts`
- `packages/slopcode/test/fixture/remote-orchestrator-antigravity.ts`

## Validation evidence

All tests were run from package directories, never the repository root.

| Command | Result |
| --- | --- |
| `bun test src` in `packages/android` | Pass: 87 tests, 404 expectations across 12 files |
| `bun run typecheck` in `packages/android` | Pass: `tsgo --noEmit` |
| `bun run build:web` in `packages/android` | Pass: 2,185 modules transformed; built in 18.48s |
| `./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin` in `packages/android` | `BUILD SUCCESSFUL`; Kotlin unit tests pass and the instrumented SSH test compiles |
| `bun test test/remote-orchestrator.test.ts` in `packages/slopcode` | Pass: 18 tests, 108 expectations |
| `bun run typecheck` in `packages/slopcode` | Pass: `tsgo --noEmit` |
| Focused Android boundary/lifecycle suite | Pass: 31 tests, 188 expectations |
| `bunx prettier --check` on every changed TypeScript/TSX file | Pass: all matched files use Prettier style |
| `git diff --check -- packages/android packages/slopcode` | Pass: no whitespace errors |

The web build emitted its existing dynamic/static import, duplicate source-map output, and large-chunk warnings but exited successfully. Kotlin compilation emitted the existing JSch `setPassword` deprecation warning during the first non-incremental unit run.

## Self-review

- Confirmed all native command construction receives only the exact canonical bound workspace; no containment fallback, parent, child, sibling, root, or symlink alias is accepted.
- Confirmed selecting an invalid workspace clears the previous binding, and disconnect clears binding state before any later execution can proceed.
- Confirmed the orchestrator event subscription exists before native start, channel scope is assigned before protocol frames, and all native event variants are filtered by ID.
- Confirmed failed startup cleanup order is wire-state clear, wire close/pending rejection, native stop, then user-visible error.
- Confirmed fallback is Antigravity-only, at most once, stderr-gated, and never shell-interpolates the prompt.
- Confirmed signed-out authentication text is explicitly rejected and the probe remains `agy models` rather than a generative request.
- Confirmed Antigravity enters the PTY path directly while non-Antigravity initial mode is unchanged, and retry controls require a live session and wire.
- Confirmed the protected gallery artifact was unchanged and excluded from the fix-wave staging set.

## Remaining limitations

- The live connected Android SSH instrumentation run was not executed because no disposable host/device credentials were supplied. Its source compiles successfully, and native scope behavior has deterministic Kotlin coverage.
- No real Antigravity model turn was made. Compatibility behavior is covered by the deterministic fake child; the authenticated/signed-out `agy models` observations are non-generative evidence.
- Existing Vite warnings remain as noted above. There are no remaining fix-wave blockers.
