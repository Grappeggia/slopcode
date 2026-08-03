# Task 4 Report: Remote API and workspace routing

## Status

DONE_WITH_CONCERNS

Commit: `feat(server): add remote workspace target routing` (exact hash in final handoff)

## Scope completed

- Implemented typed remote pairing/target contracts in `packages/protocol/src/remote.ts`, including:
  - payload-friendly HttpApi input schemas
  - redacted pairing/host response shapes
  - strict remote target header validation
  - loopback-only remote target URL validation
  - explicit remote capability header contract
- Added real server-side remote pairing persistence and selected-target lookup in `packages/slopcode/src/server/routes/instance/httpapi/remote-pairing.ts`.
- Added authenticated remote workspace routes in `packages/slopcode/src/server/routes/instance/httpapi/groups/workspace.ts` and handlers in `handlers/workspace.ts` for:
  - host listing
  - pairing create/revoke
  - SSH validation handoff
  - target registration
  - pairing selection
- Protected target registration behind a distinct supervisor capability header (`x-slopcode-remote-supervisor-token`) and `SLOPCODE_REMOTE_SUPERVISOR_TOKEN`; ordinary server Basic auth alone is not enough.
- Kept pairing secrets out of ordinary listings: host/pairing list responses are redacted and do not expose reusable pairing codes or registered target headers.
- Wired selected workspace target routing through:
  - shared `/api` routing
  - instance/v1-style workspace routing
  - session-owned message / permission / question routes
  - event SSE
  - PTY HTTP + WebSocket routing
  - session/fs/permission/question/PTY/location handlers
- Added shared server routing support in `packages/server` for route-location propagation and PTY scoping.
- Fail-closed behavior now returns conflict/unavailable responses when a selected remote workspace has no active registered target.
- Proxy sanitization strips forwarded client credentials/private headers before remote forwarding and only applies supervisor-registered remote capability headers.

## Validation / behavior notes

- SSH validation is no longer a fake unauthenticated in-memory stub.
- The server does not directly probe arbitrary SSH destinations itself. Instead, the authenticated desktop supervisor must register the exact validated remote target through the new control-plane endpoint, after which:
  - `select` establishes the active target
  - subsequent routed API calls resolve against that active target
  - missing/unregistered targets fail closed
- This keeps SSRF surface constrained to loopback-only remote bridge URLs plus a distinct supervisor token.

## Focused tests run

From `packages/protocol`:

- `bun run typecheck` ✅
- `bun test test/remote.test.ts` ✅

From `packages/server`:

- `bun run typecheck` ✅

From `packages/slopcode`:

- `bun run typecheck` ✅
- `bun test test/server/httpapi-remote-pairing.test.ts --bail` ✅
- `bun test test/server/httpapi-workspace.test.ts --bail` ✅
- `bun test test/server/httpapi-v2-workspace-routing.test.ts --bail` ✅

Coverage exercised by the focused server tests includes:

- authenticated pairing/host routes
- unauthorized supervisor target registration rejection
- invalid target URL/header rejection
- pairing list redaction / no secret leakage
- selected target propagation into shared `/api` routing
- session-owned route scoping
- SSE event proxying
- PTY WebSocket proxying
- reconnect/backfill fence waiting
- forwarded-header stripping while preserving supervisor-registered capability headers

## Files in this slice

- `packages/protocol/src/remote.ts`
- `packages/server/src/api.ts`
- `packages/server/src/errors.ts`
- `packages/server/src/groups/location.ts`
- `packages/server/src/groups/pty.ts`
- `packages/server/src/handlers.ts`
- `packages/server/src/handlers/pty.ts`
- `packages/server/src/handlers/session.ts`
- `packages/server/src/middleware/authorization.ts`
- `packages/server/src/middleware/route-location.ts`
- `packages/server/src/routes.ts`
- `packages/slopcode/src/server/proxy-util.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/groups/workspace.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/handlers/workspace.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/middleware/server-workspace-routing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/remote-pairing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/server.ts`
- `packages/slopcode/src/server/shared/workspace-routing.ts`
- `packages/slopcode/test/server/httpapi-instance-context.test.ts`
- `packages/slopcode/test/server/httpapi-promptasync-context.test.ts`
- `packages/slopcode/test/server/httpapi-remote-pairing.test.ts`
- `packages/slopcode/test/server/httpapi-v2-workspace-routing.test.ts`
- `packages/slopcode/test/server/httpapi-workspace-routing.test.ts`
- `packages/slopcode/test/server/httpapi-workspace.test.ts`

## Deferred / concerns

- Desktop / relay / Qt consumption of the new supervisor-target handoff is intentionally deferred. This slice defines the authenticated server contract and routing behavior, but the desktop host still needs to supply the supervisor token and post validated target registrations in production flows.
- New imports were not switched to `@slopcode-ai/protocol` in `packages/server` / `packages/slopcode` because those package manifests do not currently declare that dependency.
- The PTY WebSocket proxy coverage passes, but the underlying Effect/Node server still logs a `Socket already assigned` warning during the successful PTY upgrade path. The test remains green; the warning is worth a follow-up if you want a quieter websocket harness.

## Task 4 implementation

Status: DONE_WITH_CONCERNS

Implementation commit: `74ae2384d5` (`feat(app): complete titlebar tab parity`)

Changed files:

- `packages/app/src/app.tsx`
- `packages/app/src/components/titlebar-sortable-tab.tsx`
- `packages/app/src/components/titlebar.tsx`
- `packages/app/src/context/local.tsx`
- `packages/app/src/context/tab-key.ts`
- `packages/app/src/context/tab-migration.ts`
- `packages/app/src/context/tab-state.test.ts`
- `packages/app/src/context/tab-state.ts`
- `packages/app/src/context/tabs.test.ts`
- `packages/app/src/context/tabs.tsx`
- `packages/app/src/pages/directory-layout.tsx`

Implemented:

- Persistent user-reordering for V2 titlebar tabs using the app's existing Solid drag-and-drop stack.
- A titlebar Home toggle and `mod+b` command that work in both V2 and legacy layouts and restore the most recent open tab across server routes.
- Bounded, deduplicated, stale-pruned recent-tab persistence, including close, reopen, promotion, server removal, and session removal paths.
- Selected model and variant carryover into new draft tabs, with draft model state retained through tab persistence and migration.
- Reordered keyboard tab selection and close/reopen behavior continue to follow the persisted tab order.

Validation from `packages/app`:

- `bun test --preload ./happydom.ts ./src/context/tab-state.test.ts ./src/context/tabs.test.ts` — 17 passed, 0 failed, 45 assertions.
- `bun run typecheck` — passed.
- `bun run build` — passed; 2,160 modules transformed in 15.18s. Existing Vite warnings remained for the Virtua JSX pragma, static/dynamic theme import, duplicate WASM sourcemap, and large chunks.
- `git diff --check` and staged diff check — passed.

Concerns:

- No live desktop pointer/keyboard interaction run was performed in this task; Task 8 owns installed-desktop smoke verification.
- `bunx oxlint` could not parse the repository's existing `.oxlintrc.json` because `options.typeAware` is placed where the invoked oxlint version rejects it. Typecheck and production build passed.

## Task 4 implementation review fixes

Status: COMPLETE

Implementation commits:

- `74ae2384d5` (`feat(app): complete titlebar tab parity`)
- `5928f847ac` (`fix(app): close task 4 parity gaps`)
- `a4b34e3d7a` (`fix(app): preserve routed tab identity`)
- `e0d51eb8f2` (`fix(app): close active branch tabs`)

Review fixes completed:

- Preserved canonical server identity while retaining legacy session-route compatibility.
- Added the Home toggle to both titlebar layouts and removed keyboard/menu shortcut collisions.
- Added accessible keyboard tab reordering with live announcements alongside pointer reordering.
- Made recent-tab hydration merge queued updates into persisted state, bounded and deduplicated to 25 valid open tabs.
- Preserved selected model and variant state through draft creation, persistence, migration, and promotion.
- Corrected draft-close matching when extra query parameters are present.
- Made closing the selected parent tab while viewing a child branch navigate away correctly, preventing route synchronization from recreating the closed tab.

Additional changed files:

- `packages/app/src/components/titlebar-tab-keyboard.ts`
- `packages/app/src/components/titlebar-tab-keyboard.test.ts`
- `packages/app/src/context/command-keybinds.ts`
- `packages/app/src/context/command-keybinds.test.ts`
- `packages/app/src/context/layout-route.ts`
- `packages/app/src/context/layout-route.test.ts`
- `packages/app/src/context/layout.tsx`
- `packages/app/src/context/tab-controller.ts`
- `packages/app/src/desktop-menu.ts`
- `packages/app/src/pages/layout.tsx`

Final validation from `packages/app`:

- `bun test --preload ./happydom.ts ./src/context/tab-state.test.ts ./src/context/tabs.test.ts ./src/context/layout-route.test.ts ./src/context/command-keybinds.test.ts ./src/components/titlebar-tab-keyboard.test.ts` — 26 passed, 0 failed, 70 assertions.
- `bun run typecheck` — passed.
- `bun run build` — passed; 2,163 modules transformed in 16.03s. Existing Vite warnings remained for the Virtua JSX pragma, static/dynamic theme import, duplicate WASM sourcemap, and large chunks.
- `git diff --check` — passed.
- Final bounded independent review — `Spec Compliance: ✅`; `Code Quality: Approved`.

Remaining concerns:

- Installed-desktop pointer/keyboard smoke testing remains deferred to Task 8, as required by the plan scope.
- The repository's existing oxlint configuration/version incompatibility remains outside Task 4; package typecheck and production build are clean.

## Review fixes

Status: COMPLETE

Implementation commit: current Task 4 review-fix commit (`fix(app): isolate draft tab model state`)

Changed files:

- `packages/app/src/app.tsx`
- `packages/app/src/components/titlebar.tsx`
- `packages/app/src/context/draft-route.ts`
- `packages/app/src/context/draft-route.test.ts`

Review fixes completed:

- Draft route provider scope now includes both the draft ID and directory, so switching between drafts in one directory creates isolated local model/variant state while moving one draft to another directory still reinitializes its data providers.
- Session-tab close controls now expose the localized `common.closeTab` name and tooltip.
- Added regression coverage for draft route scope identity.

Validation from `packages/app`:

- `bun test --preload ./happydom.ts ./src/context/draft-route.test.ts ./src/context/tab-state.test.ts ./src/context/tabs.test.ts ./src/components/titlebar-tab-keyboard.test.ts` — 23 passed, 0 failed, 62 assertions.
- `bun run typecheck` — passed.

Remaining concerns:

- Installed-desktop interaction testing remains scoped to Task 8.


## Android SSH harness remediation

### Delivered

- Replaced skipped live SSH instrumentation with a required, actionable fixture gate. It accepts only staged private files for the private key and password; no credential payload is accepted through Gradle or instrumentation arguments.
- Added ordered adb orchestration for host-key first use and mismatch, private-key and password login, SFTP browsing/path validation/dotfile default, one intentionally missing allowlisted CLI install, all five preflight/auth/one-shot runs, PTY input/resize/Ctrl-C, reconnect, force-stop persistence, session deep-link smoke, optional real network isolation, and deterministic persisted-job/notification-action model checks.
- Restricted remote workspace activity to `/home/agent/temp`, required explicit installation acknowledgement, and made the runner parse Android's test result code instead of trusting adb's process exit status.

### Validation

- `bun test src` — 95 passing tests.
- `bun run typecheck` and `bun run build` — passed.
- `./gradlew :app:compileDebugAndroidTestKotlin :app:testDebugUnitTest --tests dev.slopcode.android.SshModelsTest --tests dev.slopcode.android.RemoteJobModelsTest` — passed.
- Connected emulator: built/installed debug and test APKs, then verified an unconfigured instrumentation invocation fails with protected-fixture instructions instead of skipping or passing.

### Blocker

No protected SSH host, private-key file, password file, and deliberately missing but installable configured CLI were provided in this environment. No live SSH, SFTP, or remote-agent success is claimed; run `packages/android/scripts/run-ssh-e2e-all-agents.sh` with its required protected environment inputs to execute the live release-candidate run.
