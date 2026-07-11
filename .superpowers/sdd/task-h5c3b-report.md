# H5C3B Report

## Design

- Added one configured-package loader feeding registrations into the existing `PluginV2` and H5C3A tool adapter. No second hook/tool runtime or V1 bridge was introduced.
- Reads the highest-priority `Config.Info.plugins` declaration with its document path, prepares that document directory, resolves relative paths from that origin, and installs npm specs through `Npm.Service`.
- Resolves package `exports["./server"]`, then `main`, then index/direct fallbacks. Lexical and real-path containment checks reject package-root escapes. Stable npm installs enforce `engines.slopcode`; local paths skip the check.
- Imports packages in config order, deduplicates factory identities, invokes factories sequentially, preserves options, derives stable IDs, and relies on PluginV2 replacement/scopes/disposal/source slots.
- Structurally creates legacy `PluginInput` with the SDK client, Location/project paths, server URL, Bun shell, and injectable workspace registration. `PluginPackage.Host` supplies production/test transport; the embedded fallback always throws typed `ClientUnavailableError` and never uses ambient network fetch.
- Adapts only `tool`, before/after tool execution, and `dispose`. Unsupported hooks publish `plugin.warning`; install, entrypoint, compatibility, import, factory, and hook-shape failures publish staged `plugin.failed` events and do not stop later exports/packages.
- Completes PluginBoot's pre-tool phase before configured package tools attach, avoiding the built-in-tool/adapter cycle, while final `PluginBoot.wait()` still waits for configured packages and local tool discovery.

## TDD Evidence

### RED

- `bun test test/plugin-package.test.ts` from `packages/core`: failed with `Cannot find module '@slopcode-ai/core/plugin/package'`.
- New configured-package Location boot test initially timed out at 5000 ms, exposing the pre-tool phase/adapter deadlock.

### GREEN

- `bun test test/plugin-package.test.ts`: 5 pass, 0 fail.
- `bun test test/location-layer.test.ts`: 5 pass, 0 fail after phase-order fix.
- `bun test test/plugin-package.test.ts test/plugin-tool.test.ts test/location-layer.test.ts`: focused package/adapter/location coverage passed.
- `bun test` from `packages/core`: 1290 pass, 0 fail, 3687 expectations.
- `bun test` from `packages/codemode`: 254 pass, 0 fail, 744 expectations.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `git diff --check`: passed.

## Files

- `packages/core/src/plugin/package.ts`: configured resolution, SDK host boundary, factory/hook adaptation, warnings, and staged failures.
- `packages/core/src/plugin/boot.ts`: ordered package boot integration and deadlock-safe phase boundary.
- `packages/core/src/plugin.ts`: warning event and staged package failure metadata.
- `packages/core/test/plugin-package.test.ts`: origin/path/npm/entrypoint/root/engine/options/export/order/transport/warning/failure/continuation coverage.
- `packages/core/test/location-layer.test.ts`: configured package boot completion and healthy continuation regression.
- `packages/core/package.json`: SDK workspace dependency.
- `packages/core/tsconfig.json`: SDK DOM transport types.

## Commits

- `8efb058cb6 feat(plugin): load configured packages`
- `c75cecfee0 test(plugin): cover package load failures`
- `37e6a37e6e fix(plugin): avoid configured tool boot deadlock`
- Report commit: this document's commit.

## Self-Review

- Confirmed no imports of `@slopcode-ai/plugin`, V1 services, `InstanceState`, `EventV2Bridge`, or legacy Session execution.
- Confirmed deprecated auth packages are checked before `Npm.add` and only emit warnings.
- Confirmed failed imports retry only for local missing-module errors, only once, after dependency preparation, with a cache-busting URL; factories are never retried.
- Confirmed configured tools still execute through H5C3A, whose focused tests cover canonical function/CodeMode settlement, hooks, permission, progress, bounding, replacement, removal, and disposal.
- Confirmed malformed exports are isolated individually and duplicate export identities run once.

## Concerns

- No known correctness concerns. Production embedding must provide `PluginPackage.Host`; absence intentionally produces the typed unavailable SDK transport and a no-op workspace registration callback.
