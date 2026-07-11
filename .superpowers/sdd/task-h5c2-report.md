# H5C2 Report

## Design

- Added `Tool.dynamic` to the existing opaque Core `Tool` carrier and `WeakMap` runtime. It captures adapter callbacks, clones and freezes externally supplied JSON schemas, decodes unknown input before execution, encodes output through the adapter, normalizes canonical `ToolOutput`, and preserves defects.
- Extended `ToolRegistry.materialize` with a separate ephemeral `TurnTools` argument. Ordered overlay records detect duplicates, overlay registrations replace persistent registrations only in that materialization, and direct names are copied into the materialization.
- Kept one settlement and `ToolOutputStore.bound` path. Persistent registrations retain stale-identity checks; overlay registrations execute their captured identities independently of later registry changes.
- CodeMode catalogs exclude direct names and recursive `exec`. Function and code-preferred modes advertise ordinary/direct definitions once; code-only advertises synthesized `exec` plus direct definitions.
- Captured permission rules and plan values are immutable per materialization. Permission aliases and denial filtering apply equally to persistent and overlay tools.

## TDD Evidence

### RED

Command:

```sh
cd packages/core && bun test test/tool-dynamic.test.ts test/tool-overlay.test.ts
```

Result before implementation: `0 pass, 6 fail`. Failures showed missing `Tool.dynamic`, ignored overlay tools, missing direct projection, and absent duplicate/name validation.

### GREEN

Focused command:

```sh
cd packages/core && bun test test/tool-dynamic.test.ts test/tool-overlay.test.ts test/tool-codemode.test.ts test/application-tools.test.ts
```

Result: `23 pass, 0 fail, 94 expect() calls`.

Full commands:

```sh
cd packages/core && bun test
cd packages/codemode && bun test
cd packages/core && bun run typecheck
cd packages/server && bun run typecheck
```

Results:

- Core: `1265 pass, 0 fail, 3562 expect() calls`.
- CodeMode: `254 pass, 0 fail, 744 expect() calls`.
- Core typecheck: passed.
- Server typecheck: passed.

## Files

- `packages/core/src/tool/tool.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/test/tool-dynamic.test.ts`
- `packages/core/test/tool-overlay.test.ts`
- `.superpowers/sdd/task-h5c2-report.md`

## Commits

- `6eca42d63a feat(tool): add turn-local dynamic tools`
- Report commit: this document's commit.

## Self-Review

- Confirmed caller schema mutation cannot change definitions and nested schema objects are frozen.
- Confirmed dynamic config callbacks are captured rather than read from a caller-owned config later.
- Confirmed adapter failures settle as model-safe `ToolFailure` results while defects and interruption remain defects/interruption.
- Confirmed overlays do not enter Application/Location state, can override persistent tools locally, and remain isolated across materializations.
- Confirmed persistent Application/Location precedence and stale identity behavior remain covered by existing tests.
- Confirmed direct overlays are absent from CodeMode discovery and nested invocation but remain directly settleable.
- Confirmed no plugin, MCP, structured-final-output, HTTP, SDK, TUI, or provider behavior was added.

## Concerns

- None.
