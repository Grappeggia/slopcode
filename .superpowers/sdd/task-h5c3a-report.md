# H5C3A Report

## Design

- Added a Core-owned structural plugin tool contract with no SDK or plugin-package dependency. Zod raw shapes retain their generated schema and original decoders; legacy JSON-schema fields use Ajv validation.
- Added one scoped `PluginV2` adapter attachment that converts plugin maps to `Tool.dynamic` and registers only through `Tools.Service`. Replacement builds the new child scope before closing the old scope; removal and Location shutdown close registrations and call `dispose` once.
- Added ordered Config Directory discovery for `{tool,tools}/*.{js,ts}` after directory dependencies install. Each file/export is isolated, names are filename-derived, later sources win through normal scoped registration, and typed `plugin.failed` events record failures.
- Plugin execution captures Location, permission, and event services. `ask` uses canonical tool source IDs, metadata publishes durable ordered progress, interruption aborts and awaits Promise cleanup, and before/after hooks are revalidated.
- Result normalization maps text, structured metadata, and strict base64 data-URL files into canonical output. `ToolRegistry` remains the sole settlement/bounding boundary and CodeMode consumes the same materialized tools.

## RED Evidence

- `bun test test/plugin-tool.test.ts` from `packages/core`: failed before implementation with `Cannot find module '@slopcode-ai/core/plugin/tool'` (`0 pass`, `1 fail`, `1 error`).

## GREEN Evidence

- `bun test test/plugin-tool.test.ts`: `6 pass`, `0 fail`, including schemas, hooks, permissions, progress, interruption, dispose/replacement, discovery isolation, precedence, attachments, and CodeMode execution.
- `bun test test/plugin-tool.test.ts test/plugin.test.ts test/tool-dynamic.test.ts test/tool-overlay.test.ts && bun run typecheck`: `18 pass`, `0 fail`; Core typecheck passed.
- `bun test` from `packages/core`: `1275 pass`, `0 fail`.
- `bun test` from `packages/codemode`: `254 pass`, `0 fail`.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

## Files

- `packages/core/src/plugin/tool.ts`
- `packages/core/src/plugin.ts`
- `packages/core/src/plugin/boot.ts`
- `packages/core/src/location-layer.ts`
- `packages/core/src/tool/tool.ts`
- `packages/core/test/plugin-tool.test.ts`
- `packages/core/package.json`
- `bun.lock`

## Commits

- `e975e2756a feat(plugin): register location custom tools`
- Report committed separately after this document was written.

## Self-Review

- Confirmed no configured npm plugin package loading, PluginInput/SDK construction, MCP changes, ApplicationTools mutation, or V1 execution changes.
- Confirmed adapter code contains no `any` escape and plugin promises cannot convert interruption or hook defects into ordinary tool failures.
- Confirmed local and programmatic registrations use the same adapter and canonical registry identity semantics.
- Confirmed only H5C3A files are included and the branch was not pushed.

## Concerns

- No known H5C3A correctness concerns. Configured npm plugin loading remains intentionally deferred to H5C3B.

## Review Correction

This section supersedes the original coverage and self-review claims above where they implied the rejected edge cases were already gated.

### Fix Design

- Wrapped plugin-map reads, file imports/exports, export inspection, Zod object/schema generation, legacy schema construction/compilation, and `Tool.dynamic` construction in typed `PluginTool.LoadError` boundaries. Discovery publishes/logs failures and continues unrelated exports/directories; execution and hook defects remain defects.
- Registered `dispose` before canonical tools so LIFO scope shutdown deregisters tools first, then awaits disposal exactly once. Added slow remove/replacement and plugin/Location shutdown gates.
- Added an ordered final `SessionEvent.Tool.Progress` projection carrying the post-hook title and metadata before canonical success settlement.
- Collects all valid exports for one Config Directory before registration, rejects every export participating in an ambiguous generated name, and preserves cross-directory precedence.
- Split PluginBoot into configured-plugin and complete phases so built-ins can register before custom discovery without deadlocking `PluginBoot.wait`.

### Review RED Evidence

- `bun test test/plugin-tool.test.ts`: `5 pass`, `5 fail`. Reproduced an uncaught `z.toJSONSchema` defect, absent execute/after title progress, visible registrations during slow disposal, missing real-store bounding, and accepted same-directory collisions.
- `bun test test/location-layer.test.ts`: `2 pass`, `1 fail`; the new bad-tool `PluginBoot.wait` gate timed out after 5000 ms.
- `bun test test/plugin-tool.test.ts -t "preserves defects from plugin execution"`: `0 pass`, `1 fail`; execution rejection was incorrectly projected as an ordinary successful settlement.
- The first phased-boot regression run exposed mock incompatibility (`PluginBoot.plugins`) and retained Location caching; the helper was moved behind `PluginBoot.beforeTools`, and the Location gate now releases and explicitly invalidates the cached Location.

### Review GREEN Evidence

- `bun test test/plugin-tool.test.ts test/plugin.test.ts test/tool-dynamic.test.ts test/tool-overlay.test.ts`: `23 pass`, `0 fail`, `113 expect()` calls.
- `bun test test/location-layer.test.ts test/tool-skill.test.ts test/tool-task.test.ts`: `25 pass`, `0 fail`, `108 expect()` calls.
- `bun run typecheck` from `packages/core`: passed.
- `bun test` from `packages/codemode`: `254 pass`, `0 fail`, `744 expect()` calls.
- `bun run typecheck` from `packages/server`: passed.
- First full Core run: `1281 pass`, `1 fail`; the unrelated process readiness test observed an empty just-created PID file. Its isolated rerun passed (`1 pass`, `0 fail`).
- Final `bun test` from `packages/core`: `1282 pass`, `0 fail`, `3641 expect()` calls.
- `git diff --check`: passed.

### Added Gates

- Typed Zod, invalid legacy, and canonical-construction adaptation failures followed by a healthy registration.
- Execute-title and after-hook-title durable progress, invalid after-hook output, malformed non-attachment result objects, and execution-defect preservation.
- Slow remove/replacement invisibility, plugin-scope disposal, and real `LocationServiceMap` shutdown disposal exactly once.
- Real `ToolOutputStore` truncation and managed full-output persistence.
- PluginBoot successful completion with a bad local export and a later healthy tool.
- Default-vs-named and `tool/`-vs-`tools/` same-directory collisions, plus retained cross-directory precedence and CodeMode execution.

### Review Commit

- `b0bc713a4e fix(plugin): close H5C3A review gaps`

### Review Concerns

- No remaining H5C3A correctness concerns. One unrelated process readiness test was transient on the first full run and passed both isolated and final full-suite reruns.
