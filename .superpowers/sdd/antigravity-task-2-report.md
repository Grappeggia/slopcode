# Task 2 — Android native SSH agent integration

## Status

Implemented and verified on top of Task 1 commit `c132e917b4`.

## Files changed

- `packages/android/src/ssh.ts`
  - Added the native-only public SSH agent ID `antigravity-cli`.
  - Added the fixed official install recipe: `curl -fsSL https://antigravity.google/cli/install.sh | bash`.
  - Added the fixed interactive login recipe: `agy`.
- `packages/android/src/ssh-connect.tsx`
  - Added Antigravity display metadata to the native SSH agent selector. Existing setup output URL extraction remains limited to validated `https` URLs and uses the existing browser-intent bridge.
- `packages/android/src/ssh-orchestrator.ts`
  - Maps `antigravity-cli` to durable bridge/orchestration ID `antigravity`.
- `packages/android/src/ssh-agentic-session.tsx`
- `packages/android/src/ssh-session.tsx`
- `packages/android/src/ssh-shell.tsx`
  - Added Antigravity names to native SSH session displays.
- `packages/android/app/src/main/java/dev/slopcode/android/SshModels.kt`
  - Added the allowlisted native `ANTIGRAVITY` enum entry using binary `agy`.
  - Uses bounded, non-prompting `agy agents` as the auth probe. It reports ready only when a real listed agent proves an authenticated result; otherwise it reports Needs setup.
  - Runs the official fixed install script only for this enum entry; normal fixed argv commands now quote every argument.
  - Rejects SSH start requests carrying a user-provided `command` field.
- `packages/android/src/ssh.test.ts`
- `packages/android/src/ssh-orchestrator.test.ts`
- `packages/android/app/src/test/java/dev/slopcode/android/SshModelsTest.kt`
  - Added focused parsing, recipes, command construction/safety, status routing, agent mapping, and native bridge payload tests.

## Commands and results

- `cd packages/android && bun test src/ssh.test.ts src/ssh-orchestrator.test.ts` — passed: 11 tests, 60 expectations.
- `cd packages/android && bun run typecheck` — passed.
- `cd packages/android && bun test src` — passed: 76 tests, 372 expectations.
- `cd packages/android && bun run build:web` — passed. Vite reported its existing dynamic-import/chunk-size warnings.
- `cd packages/android && ./gradlew :app:testDebugUnitTest` — passed. Existing Kotlin deprecation warnings were emitted from `MainActivity.kt` and `SshTransport.kt`.
- `git diff --check` — passed.

The first attempt to select only the Kotlin class with `./gradlew test --tests dev.slopcode.android.SshModelsTest` was unsupported by this project's wrapper/task configuration; the full debug unit-test task passed instead.

## Self-review

- Antigravity is present only in the native Android SSH catalog; no legacy HTTPS/desktop relay catalog or endpoint was changed.
- Slopcode remains the first/default/recommended agent, and the existing four agents retain their prior recipes and behavior.
- No prompt or arbitrary user command is incorporated into command construction. Prompt text remains PTY input, setup commands are enum-selected, fixed argv is quoted, and payloads with `command` are rejected.
- The login flow uses the existing PTY output and existing validated-HTTPS browser-link path; no new transport or browser path was introduced.
- No real installer or interactive Antigravity login was run.
- The unrelated pre-existing `artifacts/android-ssh-flow/index.html` worktree change was not edited or included.

## Concerns

- Antigravity exposes no documented dedicated auth-status command. `agy agents` is deliberately conservative: an empty successful result is treated as Needs setup, so a future CLI output-format change may require updating the proof-of-login matcher.
