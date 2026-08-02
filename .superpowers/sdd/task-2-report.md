# Task 2 Report: desktop host and SSH workspace supervisor reviewer fixes

## Status

DONE_WITH_CONCERNS

## Scope completed

- Added a desktop-main-process remote host contract under `packages/desktop/src/main/remote/contract.ts`.
- Added an SSH workspace supervisor under `packages/desktop/src/main/remote/ssh.ts`.
- Added a small export surface in `packages/desktop/src/main/remote/index.ts`.
- Added focused unit coverage in `packages/desktop/src/main/remote/ssh.test.ts`.
- Switched desktop remote protocol imports to the public `@slopcode-ai/protocol` package export and declared the workspace dependency in `packages/desktop/package.json`.
- Scoped remote SSH bootstrap/stop lifecycle state to a deterministic per-workspace key derived from the normalized SSH target.
- Ensured the remote server launches from the selected remote directory and only reattaches to state for that same normalized workspace.
- Added cancellation/generation handling so `stopWorkspace` / `stopAll` cancel pending startup and clean up tunnel, host-key, and remote-process state before stale starts can become active.

## Protocol alignment

- The supervisor now consumes the public shared protocol export from `@slopcode-ai/protocol`.
- Host and SSH workspace inputs are still decoded against the shared protocol schemas before desktop-specific normalization and lifecycle handling.

## What the supervisor does

- Normalizes and validates SSH targets at the desktop boundary:
  - SSH host/user token checks
  - absolute local identity/known_hosts path checks
  - explicit absolute POSIX remote-directory checks
  - stable workspace identity derivation from normalized SSH authority + remote directory
  - deterministic per-workspace state-key derivation from the normalized identity
- Builds SSH argv arrays without shell interpolation of user input.
- Requires an explicit host-key policy (`known_hosts` path or pinned entry) instead of weakening host-key checks.
- Uses fixed remote `sh -se` scripts for bootstrap/stop operations, keeps state filenames free of raw path input, and launches the remote server from the selected directory.
- Launches or re-attaches to a loopback-only remote SlopCode server via a per-workspace remote state file, then maintains a local SSH tunnel.
- Validates the selected remote directory through the tunneled SlopCode HTTP API (`/path?directory=...`) rather than through shell interpolation.
- Exposes typed lifecycle states and subscription hooks:
  - `validating`
  - `starting`
  - `ready`
  - `stopped`
  - `failed`

## Files changed

- `packages/desktop/src/main/remote/contract.ts`
- `packages/desktop/src/main/remote/ssh.ts`
- `packages/desktop/src/main/remote/index.ts`
- `packages/desktop/src/main/remote/ssh.test.ts`
- `packages/desktop/package.json`
- `.superpowers/sdd/task-2-report.md`

## Validation

Run from `packages/desktop`:

```text
bun test src/main/remote/ssh.test.ts
9 pass, 0 fail

bunx tsc --noEmit --module ESNext --moduleResolution bundler --target ESNext --skipLibCheck --allowSyntheticDefaultImports --esModuleInterop --jsx preserve --jsxImportSource solid-js --allowJs --resolveJsonModule --strict --isolatedModules --types vite/client,node,electron src/main/remote/contract.ts src/main/remote/index.ts src/main/remote/ssh.ts
passed

bun run typecheck
tsgo -b — blocked by pre-existing unrelated errors:
- `../app/src/context/server.test.ts`: missing `isServerStateReady` export from `./server`
- `../app/src/context/tabs.test.ts`: missing `decodeSessionTabDirectory` export from `./tabs`
```

## Concerns

- The fix stays intentionally scoped to the Task 2 SSH supervisor files and focused unit coverage. It does not broaden into new IPC, persistence, or renderer wiring.
- Full `packages/desktop` typecheck is currently blocked by unrelated existing export mismatches under the referenced `packages/app` project, so task verification uses a focused remote-file typecheck alongside the targeted SSH tests.

# Task 2 implementation

## Commit

`b2da89122136988c14f726a917c62149cb574b3f` — `feat(app): add v2 session surface`

## Changed files

- `packages/app/src/components/file-tree.tsx`
- `packages/app/src/components/file-tree-v2.tsx`
- `packages/app/src/components/file-tree-v2-model.ts`
- `packages/app/src/components/file-tree-v2-model.test.ts`
- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/message-timeline.tsx`
- `packages/app/src/pages/session/message-timeline.data.ts`
- `packages/app/src/pages/session/message-timeline.data.test.ts`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/terminal-panel.tsx`
- `packages/app/src/pages/session/terminal-panel-v2.tsx`
- `packages/app/src/pages/session/v2/review-diff-kinds.ts`
- `packages/app/src/pages/session/v2/review-diff-kinds.test.ts`
- `packages/app/src/pages/session/v2/review-panel-v2.tsx`
- `packages/app/src/pages/session/v2/review-panel-v2-state.ts`
- `packages/app/src/pages/session/v2/review-panel-v2-state.test.ts`

## Implementation

- Retained the existing production Virtua timeline and moved keyed row reconciliation into the timeline model, with focused large-session and streaming-status coverage.
- Added an iterative, virtualized V2 file-tree model for both live workspace files and filtered review changes.
- Added the V2 review path with persistent/resizable sidebar state, file search, active-file routing, status markers, and single-file review rendering through the existing SlopCode review/comment APIs.
- Added a V2 terminal presentation while retaining the existing PTY lifecycle, recovery, focus, reorder, and legacy layout behavior.
- Gated the new review, file-tree, and terminal surfaces on `newLayoutDesigns`; the legacy session path remains available when disabled.

## Validation

Run from `packages/app`:

```text
bun test --preload ./happydom.ts ./src/components/file-tree.test.ts ./src/components/file-tree-v2-model.test.ts ./src/pages/session/helpers.test.ts ./src/pages/session/message-gesture.test.ts ./src/pages/session/message-timeline.data.test.ts ./src/pages/session/use-session-hash-scroll.test.ts ./src/pages/session/v2/review-diff-kinds.test.ts ./src/pages/session/v2/review-panel-v2-state.test.ts ./src/pages/session/terminal-panel.test.ts
37 pass, 0 fail, 74 expect calls

bun run typecheck
passed

bun run build
passed; 2,155 modules transformed in 12.66s
```

The build emitted the existing Virtua JSX-transform, duplicate sourcemap, mixed static/dynamic theme import, and chunk-size warnings.

## Concerns

- No live desktop interaction run was performed for this app-package task.
- The V2 review adapts the current SlopCode `SessionReview` and comment APIs instead of importing upstream's newer `session-ui` package, which is not present on this branch.

# Review fixes

## Changed files

- `packages/app/src/components/file-tree-v2-model.ts`
- `packages/app/src/components/file-tree-v2-model.test.ts`
- `packages/app/src/pages/session/message-timeline-rows.ts`
- `packages/app/src/pages/session/message-timeline.data.ts`
- `packages/app/src/pages/session/message-timeline.data.test.ts`
- `packages/app/src/pages/session/v2/review-panel-v2.tsx`
- `packages/app/src/pages/session/v2/review-panel-v2-state.ts`
- `packages/app/src/pages/session/v2/review-panel-v2-state.test.ts`

## Fixes

- Promote a path previously observed as a file to a directory when later review changes introduce descendants, preserving the child files and directory-first ordering.
- Move row identity and reconciliation into a pure timeline module so its standalone test does not load client-only UI dependencies; the production timeline continues to call the same reconciliation function.
- Keep filtered review files virtualized with fixed 30px rows and path-bound selected rows.
- Expose the sidebar's persistence target, width clamping, and visibility toggle helpers so the state behavior is directly covered.

## Validation

Run from `packages/app`:

```text
bun test --preload ./happydom.ts ./src/components/file-tree.test.ts ./src/components/file-tree-v2-model.test.ts ./src/pages/session/helpers.test.ts ./src/pages/session/message-gesture.test.ts ./src/pages/session/message-timeline.data.test.ts ./src/pages/session/use-session-hash-scroll.test.ts ./src/pages/session/v2/review-diff-kinds.test.ts ./src/pages/session/v2/review-panel-v2-state.test.ts ./src/pages/session/terminal-panel.test.ts
40 pass, 0 fail, 79 expect calls

bun run typecheck
passed
```

## Remaining concerns

- No live desktop interaction run was performed for this app-package fix.
