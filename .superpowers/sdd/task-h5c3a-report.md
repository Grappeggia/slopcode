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
