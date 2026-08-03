# Task 3 report: fixed stdio bridge and ACP adapters

## Changed files

- `packages/protocol/src/agent-orchestration.ts` and its test: added success acknowledgements plus typed reasoning, tool, retry, and plan-available events. Native backend IDs can be retained in bounded non-secret metadata.
- `packages/slopcode/src/cli/cmd/remote-orchestrator.ts` and `src/index.ts`: registered the fixed `slopcode remote-orchestrator --stdio` entrypoint.
- `packages/slopcode/src/remote-orchestrator/{bridge,acp,workspace}.ts`: added bounded JSON-line framing with strict frame validation, stdout-only protocol records, stderr diagnostics, realpath workspace containment, cleanup, an allowlisted no-shell ACP launcher, and shared ACP session lifecycle for Slopcode and OpenCode.
- `packages/slopcode/test/remote-orchestrator.test.ts` and `test/fixture/remote-orchestrator-acp-agent.ts`: added a real spawned ACP fixture covering initialization, session creation, text, reasoning, tool, diff artifact, approval, question, plan, retry, native-ID mapping, cleanup, framing, and stdout isolation.
- `packages/slopcode/package.json`: declared the protocol workspace dependency.

## Validation

- `packages/protocol`: `bun test test/agent-orchestration.test.ts` — 6 passed; `bun run typecheck` — passed.
- `packages/slopcode`: `bun test test/remote-orchestrator.test.ts --timeout 30000` — 4 passed.
- `packages/slopcode`: Prettier check for bridge, CLI, tests, and fixture — passed.
- CLI smoke test: piped a valid `workspace.open` frame to `slopcode remote-orchestrator --stdio`; received a validated response on stdout.
- `git diff --check` — passed.

## Limitations

- The ACP bridge deliberately advertises only negotiated baseline capabilities. URL elicitation and ACP update types without a lossless v1 mapping are surfaced as explicit unsupported output rather than simulated through a terminal.
- Codex and Claude adapters, durable bridge replay, plan-save commits, and Android structured UI remain Tasks 4 and 5.

## Correction commit

- Pending interactions now record owning session, kind, revision, and native ID; stale, wrong-kind, wrong-session, and replayed replies are rejected before the adapter is invoked.
- ACP artifacts are resolved through workspace `realpath` containment before they can become protocol artifacts. ACP-originated strings are control-stripped and UTF-8 byte-bounded before bridge projection.
- ACP subprocess teardown is bounded, handles an already-exited child, escalates from `SIGTERM` to `SIGKILL`, and cleans up initialization/session-creation failures.
- Focused bridge coverage now exercises stale approval, wrong-kind question, and replay replies.

## Final correction

- Public interaction IDs now include the bridge session ID before hashing, so identical native interaction IDs from separate ACP sessions remain independently replyable.
- ACP approval locations are accepted only when they are bounded, control-free absolute paths that `realpath` inside the active workspace. Invalid, traversal, and symlink-escape locations are omitted while the approval remains pending and actionable.
- Validation: `packages/slopcode` remote-orchestrator tests (10 passed), `packages/protocol` orchestration tests (6 passed), both package typechecks, and `git diff --check` passed.

## Task 3b correction

- Workspace approval and artifact paths are now checked before and after `realpath` using the same absolute, normalized, control-free, UTF-8 byte, and containment rules. Invalid canonical symlink results are omitted without dropping the pending approval.
- Each bridge session permits one active turn. A concurrent turn receives a stable `bad_request` conflict, and event callbacks capture the originating turn ID before asynchronous projection.
- Stdio requests use a bounded 256-record in-memory idempotency ledger. Equivalent request/idempotency pairs replay the original response; conflicting reuse returns `idempotency_conflict` without creating another ACP session or turn. Fingerprints are hashes, not stored prompts.
- Tool, plan, and artifact IDs and generated plan paths are scoped by bridge session and native ID. A per-session projection queue preserves ACP event order while canonical paths resolve asynchronously.
- Regression coverage includes invalid canonical symlinks and oversized/traversal paths, overlapping turns and delayed output, duplicate/conflicting session and turn requests, cross-session public-ID collisions, and asynchronous event ordering.

The bridge idempotency ledger remains intentionally in memory; durable restart recovery is still a follow-up for the journal integration and is not claimed by this correction.

## Android lifecycle and recovery follow-up

- Added a native-to-renderer Android Back contract. SSH onboarding dismisses transient host-key/setup state, returns agent selection to folders, returns folders to authentication, and only then permits the Activity fallback. Interactive PTY Back returns safely to the agentic screen; the existing PTY cleanup path remains in use.
- Added `ACCESS_NETWORK_STATE`, an immediate native offline failure, and an in-flight SSH cancellation bridge. Cancel disconnects the connecting JSch session rather than waiting for the 15-second socket timeout.
- Made remote-session deep links validate their exact persisted job/session first. Missing or expired links now show a recovery message instead of silently landing at the chooser.
- Allowed a stopped/failed/completed durable job to accept a later retry event, retaining its cursor while rejecting duplicate events.

### Verification

- `bun test src/android-back.test.ts src/remote-session-recovery.test.ts src/ssh-connect-state.test.ts src/remote-jobs.test.ts src/bridge.test.ts src/platform.test.ts` — 33 passed.
- `bun run typecheck`, `bun run build:web`, and `./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin :app:assembleDebug` — passed.

### Blocker

No protected SSH fixture credentials were available, so this follow-up does not claim a live SSH connection or agent run. The credential-gated emulator harness remains the required live validation path.

## Independent review fixes

- The shared Android Back contract now detects the SSH drawer through its explicit open-state marker while retaining `aria-hidden` and `inert` semantics. A real Chrome DOM regression opens the rendered drawer, invokes Back, and verifies both its open and closed states.
- Back during an active SSH install/sign-in invalidates onboarding first, clears setup UI, and queues native `ssh.cleanup()` so an exec channel cannot remain busy after the UI is dismissed. Native connection cancellation is generation-scoped, including cancellation before the JSch session is published.
- Remote-session links still parse legacy job-only input, but route it to the explicit recovery notice on every SSH and remote route; only an exact persisted job and session opens a session. Remote event reducers now persist a bounded history of both event IDs and cursors, reject out-of-order replay, and continue to allow terminal-job retries.
- MainActivity now gives each async WebView Back callback a request generation and invalidates callbacks on renderer navigation/destruction, so rapid Back taps or stale Activity callbacks cannot act after a newer request.

### Verification

- `bun test src/android-back.test.ts src/ssh-shell-dom.test.ts src/ssh-connect-state.test.ts src/remote-session-recovery.test.ts src/remote-session-route.test.ts src/remote-jobs.test.ts src/bridge.test.ts src/platform.test.ts` — 37 passed (the DOM test uses Vite plus headless Chrome).
- `bun run typecheck` and `bun run build:web` — passed.
- `./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin :app:assembleDebug` — passed.

### Remaining blocker

No protected SSH fixture credentials are available. These fixes do not claim a live SSH connection, setup action, or agent run; the credential-gated emulator harness remains required for that validation.

## Re-review follow-up

- Exact persisted job/session deep links on the native SSH route now open a dedicated durable-job recovery view. The view exposes the saved status, session, workspace, output/error, and an explicit “Choose SSH workspace” action; it does not claim to resume a native PTY without a backend resume contract. Stale or job-only links remain an inline recovery error.
- Connect attempts are reserved before the Android bridge queues the SSH work. Cancelling a queued request invalidates that reservation, so the worker cannot reset the generation and connect after the user has cancelled.
- The SSH drawer now hides and inerts the underlying shell content while open, enters and traps focus, handles Escape, and returns focus to the menu after Back. The headless DOM fixture checks both open and closed markers, aria, inert, and focus state.

### Verification

- `bun test src` — 114 passed; `bun run typecheck`; `bun run build:web` — passed.
- Focused modal/deep-link/replay tests — 14 passed; headless Chrome drawer check — passed.
- Native reservation/cancellation checks and Android unit/build checks passed. The final emulator gate passed `bun run test:android-ui` (3/3 instrumented tests) and `bun scripts/verify-ssh-shell-emulator.ts` (8/8 visual fixtures with cleanup verification). The fixture intentionally does not claim live SSH success; protected SSH credentials and a live authenticated PTY fixture remain unavailable.
