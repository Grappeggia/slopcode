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

- No known correctness concerns. Production server/web-handler paths now provide `PluginPackage.Host`; embedded Core without a host intentionally retains the typed unavailable SDK transport.

## Review Fixes

### Design Corrections

- Added `LocationServiceMap.withPluginHost` so hosted route stacks inject `PluginPackage.Host` into the LayerMap dependency context instead of leaving production plugins on the embedded fallback.
- Added the server `PluginServer` host with lazy in-process fetch, configured/lazy base URL, internal authorization, and project/type workspace adapter registration. `webHandler` uses hosted routes, and the CLI listener supplies its actual bound address lazily after startup.
- Directory-valued server exports and package mains now select supported nested index files only after lexical and realpath containment checks. Symlinked directories escaping the package root are rejected.
- Retry eligibility now requires a Bun module-not-found code plus an npm identity declared by the originating config directory and successful dependency preparation. The single retry imports a temporary sibling source to avoid Bun's failed-referrer cache, removes it afterward, and still occurs before factory discovery/invocation.
- Dependency preparation failures identify the config document itself in `package` and `source`; malformed package metadata, missing installed roots, and entrypoint inspection failures are classified as `entrypoint`.
- Deprecated auth packages are matched by exact `npm-package-arg` identity, including versions and aliases, while similarly named npm packages and local paths remain loadable.
- Modern IDs are validated before factory identity deduplication, so an invalid alias cannot suppress a later valid alias.

### Review RED Evidence

- `bun test test/plugin-package.test.ts` from `packages/core`: 5 pass, 4 fail. Failures showed directory exports returning the directory, malformed JSON lacking `stage: "entrypoint"`, missing exact-deprecation API, and invalid-ID alias suppression.
- Retry boundary test from `packages/core`: 10 pass, 1 fail. Installation reached count 2 but `retry_tool` remained absent, proving a query string did not bypass Bun's failed dependency-resolution cache.
- `bun test test/plugin-package.test.ts` from `packages/server`: failed before tests with `Cannot find module '../src/plugin'`, proving no production host existed.

### Review GREEN Evidence

- `bun test test/plugin-package.test.ts test/location-layer.test.ts test/plugin-tool.test.ts` from `packages/core`: 31 pass, 0 fail, 124 expectations.
- `bun test test/plugin-package.test.ts` from `packages/server`: 1 pass, 0 fail; configured plugin called `/api/health` through the lazy in-process SDK transport, observed the configured URL, and registered a workspace adapter by project/type.
- `bun test` from `packages/core`: 1298 pass, 0 fail, 3712 expectations.
- `bun test` from `packages/codemode`: 254 pass, 0 fail, 744 expectations.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `bun run typecheck` from `packages/cli`: passed.
- `git diff --check`: passed.

### Review Coverage

- Stable incompatible, stable compatible, prerelease-skipped, and local-skipped engine checks.
- Successful npm package loading, config-order factories, explicit/default IDs, duplicate-ID replacement, stable tool slot, and both replacement/final disposal.
- Before/after hook adaptation, supported hook retention, unsupported hook warnings, options identity, legacy/modern exports, duplicate identity suppression, and invalid-ID alias continuation.
- Config-source dependency failure metadata and package-level entrypoint/import/factory/hook-shape continuation.
- Declared dependency retry count/cache success plus no retry for missing source, user-thrown lookalike, or factory failure.
- Nested server/main directories, lexical escape, symlink escape, actual embedded unavailable-client call, production server client call, and healthy `PluginBoot` continuation.

### Review Commit

- `98fbc56900 fix(plugin): close configured package review gaps`
- Report append: this document's follow-up commit.

## Release-Blocker Fixes

### Design Corrections

- Unified every local fallback behind lexical-plus-realpath containment. Relative/absolute/file-URL direct files, root indexes, nested server/main indexes, and npm fallback entrypoints all validate against their lexical package root before returning a real path.
- Replaced the hosted fetch's nested `HttpRouter.toWebHandler` with a self-reference assigned to the one outer built handler. SDK requests now re-enter the same app runtime and LocationServiceMap; outer handler disposal owns plugin/Location disposal. The CLI serves that same web handler through `HttpEffect.fromWebHandler` and finalizes it with the listener scope while retaining the lazy actual bound URL.
- Made retry dependency installation a gate: a failed retry install emits the configured package's `install` failure and skips both `retryImport` and a second import failure.
- Added caller-owned PluginV2 adaptation reporting. Programmatic `PluginV2.add` keeps its default observable failure, while configured packages set `reportFailure: false` and publish exactly one package/source/stage-attributed failure themselves.
- Added a configured-package seam test using the real PluginV2 adapter, ToolRegistry, ToolOutputStore, and Config: canonical function and nested CodeMode settlement, permission source, progress/title, bounded visible output with durable full output, removal-before-slow-dispose, and Location invalidation disposal.

### Release-Blocker RED Evidence

- `bun test test/plugin-package.test.ts` from `packages/core`: 13 pass, 3 fail. A relative direct-file symlink escaped, retry installation failure still produced a cache-copy import failure, and one configured adaptation produced two `plugin.failed` events.
- `bun test test/plugin-package.test.ts` from `packages/server`: failed because the SDK's location-scoped request booted/resolved the server package Location instead of reusing the configured plugin Location, demonstrating the nested handler runtime.
- Configured Location disposal assertion initially received `0`, proving request scope closure is not Location shutdown; the corrected gate invalidates the LayerMap entry and observes disposal exactly once.

### Release-Blocker GREEN Evidence

- `bun test test/plugin-package.test.ts test/location-layer.test.ts test/plugin-tool.test.ts` from `packages/core`: 35 pass, 0 fail, 139 expectations.
- `bun test test/plugin-package.test.ts` from `packages/server`: 1 pass, 0 fail, 6 expectations; one factory invocation, same-location SDK dispatch, workspace registration, configured URL, and outer disposal.
- `bun test` from `packages/core`: 1302 pass, 0 fail, 3727 expectations.
- `bun test` from `packages/codemode`: 254 pass, 0 fail, 744 expectations.
- `bun run typecheck` from `packages/core`: passed.
- `bun run typecheck` from `packages/server`: passed.
- `bun run typecheck` from `packages/cli`: passed.
- `git diff --check`: passed.

### Release-Blocker Coverage

- Relative direct-file and root-index symlink escapes; nested directory/symlink escapes; regular absolute path and file URL success.
- Eligible retry success/cache/count and retry-install failure with no retry import; no retry for missing source, user lookalike, or factory.
- Exactly one attributed configured hook-shape failure and unchanged programmatic PluginV2 observability.
- Loaded configured tool through canonical function and nested CodeMode settlement with permission action/source, progress/title, real output bounding/full-output persistence, and supported before/after hooks.
- Tool invisibility before slow disposal completes, configured disposal completion, Location invalidation disposal, and one-runtime production SDK/workspace lifecycle.

### Release-Blocker Commit

- `6e55a86e25 fix(plugin): close package release blockers`
- Report append: this document's final evidence commit.
