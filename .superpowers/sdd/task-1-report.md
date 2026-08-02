# Task 1 Report: shared remote protocol contracts

## Status

DONE

## Scope completed

- Added a new top-level protocol module at `packages/protocol/src/remote.ts`.
- Defined versioned runtime-validated remote schemas for:
  - version and mode
  - device and host
  - SSH profile
  - local and SSH workspace variants
  - capability and pairing
  - acknowledgement
  - request, response, event, and error envelopes
- Included the required transport fields:
  - request IDs
  - event cursors
  - idempotency keys
  - acknowledgements
  - explicit `remoteDirectory` for SSH workspaces
- Exported the contracts through `@slopcode-ai/protocol` as a first-class top-level module via `src/remote.ts`.
- Added focused Bun tests in `packages/protocol/test/remote.test.ts` covering valid inputs, invalid inputs, and JSON string round trips.

## Schema notes

- The transport version is fixed to `"v1"`.
- Workspace contracts are a discriminated union:
  - `mode: "local"` requires `directory`
  - `mode: "ssh"` requires `directory`, `remoteDirectory`, and `ssh`
- Envelope payloads remain schema-validated at the envelope layer while keeping `data` open for later task-specific payload contracts.
- JSON helpers were added for both workspaces and envelopes using `Schema.fromJsonString(...)`.

## Files changed

- `packages/protocol/src/remote.ts`
- `packages/protocol/test/remote.test.ts`
- `.superpowers/sdd/task-1-report.md`

## Validation

Run from `packages/protocol`:

```sh
bun test
bun run typecheck
```

Result:

- `bun test`: 6 pass, 0 fail
- `bun run typecheck`: passed

## Concerns

- The envelope `data` fields intentionally stay generic in this task. Concrete per-message payload schemas can layer on top of these contracts in later tasks without changing the transport envelope shape.

## Review fixes

- Exported the remote contracts from the package root by adding `packages/protocol/src/index.ts` and a `"."` package export while preserving the existing `./remote` subpath export.
- Made both workspace variants exact at runtime so excess mode-specific keys are rejected instead of silently stripped during decoding.
- Added regression coverage for:
  - public root imports from `@slopcode-ai/protocol`
  - a hybrid `mode: "local"` payload that incorrectly includes `remoteDirectory` and `ssh`

## Fix validation

Run from `packages/protocol`:

```sh
bun test test/remote.test.ts test/public-root.test.ts
bun run typecheck
```

Result:

- `bun test test/remote.test.ts test/public-root.test.ts`: 5 pass, 0 fail
- `bun run typecheck`: passed

# Task 1 — New-session workspace selector

## Status

Complete. Implementation commit: `4934fc36b1` (`feat(app): add new session workspace selector`).

The new-session composer now presents the existing project selector followed by an accessible workspace selector. For Git projects it offers the local/main worktree, each existing sandbox, and a create-new-worktree action. Selecting a project resets any previous workspace choice before retargeting the draft; selecting a workspace leaves the draft route untouched and only changes the target used when the draft is promoted on submit.

## Changed files

- `packages/app/src/components/prompt-input.tsx`
  - Adds the searchable workspace picker, accessible labels, local/main and sandbox choices, and Git-only create action.
  - Resets a workspace selection before project switching retargets a draft.
- `packages/app/src/pages/new-session.tsx`
  - Replaces local worktree state with normalized selection state for the draft route.
- `packages/app/src/pages/new-session/new-session-workspace-controller.ts`
  - Adds pure resolution and normalization helpers for main, existing sandbox, and create selections.
- `packages/app/src/pages/new-session/new-session-workspace-controller.test.ts`
  - Covers resolution, normalization, explicit create/sandbox values, and option generation.
- `packages/app/src/pages/session/composer/session-composer-region.tsx`
  - Forwards the optional workspace-selection callback to the composer.
- `packages/app/src/components/prompt-input/submit.test.ts`
  - Updates the focused submit-test toast mock for the current toast utility imports.

## Verification

All commands were run from `packages/app` unless noted otherwise.

1. `bun test --preload ./happydom.ts ./src/pages/new-session/new-session-workspace-controller.test.ts`

   Output: `5 pass`, `0 fail`, `7 expect() calls`.

2. `bun test --preload ./happydom.ts ./src/components/prompt-input/submit.test.ts`

   Output: `4 pass`, `0 fail`, `11 expect() calls`.

3. `bun run typecheck`

   Output: `$ tsgo -b` and exit code `0`.

4. `bun run build`

   Output: `✓ 2149 modules transformed.` and `✓ built in 17.42s` with exit code `0`.

   Existing Vite warnings remained: a `virtua` JSX-import warning, one dynamic/static theme-import warning, a duplicate sourcemap filename warning, and chunk-size warnings. None are caused by this change.

5. From repository root: `git diff --check` and `git diff --cached --check`

   Output: no whitespace errors.

## Self-review

- Main is normalized to the project root when a draft is currently in a sandbox, so selecting “Main branch” cannot accidentally submit back into that sandbox.
- Existing sandbox selection stays a concrete directory, which the already-tested submit path uses to create and promote the session in that workspace.
- Project switching resets the workspace choice before `updateDraft`, preventing a sandbox path from one project leaking into another project’s draft.
- The selector uses the existing Kobalte popover/button pattern, includes an accessible trigger and search-input label, restores composer focus after selection, and hides the create action for non-Git projects.
- The regular session composer remains compatible because its workspace-change callback is optional.

## Concerns

- No live desktop interaction test was run for this focused app change; the production build and focused controller/submit tests passed.
- The workspace search field reuses the existing “Search projects” translation because there is no current workspace-specific search translation key. This keeps all locales intact, but a later i18n pass could add a dedicated label.

## Review fixes

- `packages/app/src/components/prompt-input.tsx`
  - Renders the shared, accessible project/workspace picker controls in both the production legacy composer and the V2 composer.
  - Uses the controller’s workspace options and reset decision so picker values have one source of truth.
- `packages/app/src/pages/new-session/new-session-workspace-controller.ts`
  - Defines the Git-only create-worktree option and project-change reset rule used by the production composer.
- `packages/app/src/pages/new-session/new-session-workspace-controller.test.ts`
  - Covers main/sandbox picker values, Git-only creation, and project-switch reset behavior.
- `packages/app/src/components/prompt-input/submit.test.ts`
  - Covers creation and session routing through a requested new worktree using the real submit implementation.

Tests run from `packages/app`:

- `bun test --preload ./happydom.ts ./src/pages/new-session/new-session-workspace-controller.test.ts ./src/components/prompt-input/submit.test.ts` — 11 pass, 0 fail.
- `bun run typecheck` — passed.
