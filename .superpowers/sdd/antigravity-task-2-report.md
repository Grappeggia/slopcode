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
  - Uses bounded, non-prompting `agy models` output. It reports Ready only for a valid listed model ID and otherwise reports Needs setup.
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

- Antigravity exposes no documented dedicated auth-status command. The current review fix uses bounded `agy models` output instead.

## Superseded review fix — credential-presence auth probe

The credential-presence approach was removed in the subsequent review fix below. It is not used by the application.

### Fix validation commands and output

- `cd packages/android && bun test src/ssh.test.ts src/ssh-orchestrator.test.ts` — passed: 11 tests, 60 expectations.
- `cd packages/android && bun test src` — passed: 76 tests, 372 expectations.
- `cd packages/android && bun run typecheck` — passed.
- `cd packages/android && bun run build:web` — passed. Vite emitted existing dynamic-import/chunk-size warnings.
- `cd packages/android && ./gradlew :app:testDebugUnitTest` — passed: 24 tasks, with existing deprecation warnings from `MainActivity.kt` and `SshTransport.kt`.
- `bunx prettier --check ...` — passed: all checked TypeScript/TSX/Markdown files match Prettier.
- `git diff --check` — passed.
- `bunx prettier --write packages/android/src/ssh.ts` — formatted the existing Task 2 TypeScript ternary.
- `bunx prettier --check ...` — passed: all checked TypeScript/TSX/Markdown files match Prettier.
- `git diff --check` — passed.

## Review fix — `agy models` auth probe

Replaced the credential-presence approach with the installed CLI's fixed non-generative `agy models` argv probe. `authScript` and all token-path logic were removed; the enum now uses `authArgs = listOf("models")`, so the existing bounded `runExec` path invokes only `agy models` and its existing timeout applies.

`SshAgent.ANTIGRAVITY.loggedIn` now requires exit code 0, rejects explicit auth/login/error/not-authenticated output, and requires at least one complete `gemini-*`, `claude-*`, or `gpt-*` model-ID line. Empty, unknown, failure-text, and nonzero results remain Needs setup. `agy` remains the interactive login command.

Local verification: `timeout 10 /home/marcos/.local/bin/agy models` exited 0 without opening a prompt or TUI and listed IDs including `gemini-3.6-flash-high`, `claude-sonnet-4-6`, and `gpt-oss-120b-medium`.

### Final validation commands and output

- `cd packages/android && bun test src/ssh.test.ts src/ssh-orchestrator.test.ts` — passed: 11 tests, 60 expectations.
- `cd packages/android && bun test src` — passed: 76 tests, 372 expectations.
- `cd packages/android && bun run typecheck` — passed.
- `cd packages/android && bun run build:web` — passed. Vite emitted existing dynamic-import/chunk-size warnings.
- `cd packages/android && ./gradlew :app:testDebugUnitTest` — passed: 24 tasks, with existing deprecation warnings from `MainActivity.kt` and `SshTransport.kt`.
- `bunx prettier --check ...` — passed: all checked TypeScript/TSX/Markdown files match Prettier.
- `git diff --check` — passed.
