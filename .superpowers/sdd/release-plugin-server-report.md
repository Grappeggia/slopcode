# Plugin/server release review report

## Result

DONE

## Changes

- Added a per-factory workspace registration owner before async plugin invocation. Closure synchronously removes registrations, rejects and cleans late registrations, awaits available plugin disposal, and transfers ownership only after successful plugin registration.
- Made `PluginV2.add` ownership transfer atomic with registry installation. Pre-install interruption closes the new scope, while interruption during replacement disposal or Added publication retains the installed plugin and its factory owner.
- Reordered factory, hook-shape, and add failure handling so workspace registrations close synchronously and plugin cleanup finishes before failure publication begins.
- Replaced the server module-global workspace map with a registry created per `PluginServer.runtime` and captured by each `webHandler` host.
- Preserved token precedence, stale cleanup safety, replacement and empty replacement behavior, Location invalidation, and host disposal.

## RED coverage

- Added deterministic factory interruption coverage that registers before cancellation, registers again after cancellation, and verifies late factory disposal.
- Added deterministic hook inspection and blocked warning publication coverage, then interrupts and verifies synchronous registration cleanup and disposal.
- Added deterministic interruption coverage after tool installation, during replacement disposal, and during blocked Added publication.
- Added blocked factory and hook-shape failure publication coverage proving adapters are already invisible, late registrations are rejected, cleanup is complete, and one failure is reported.
- Added concurrent-handler coverage for same-project/type isolation, visibility, stale cleanup, and independent outer disposal.
- Tests were authored before implementation. The first RED execution could not collect because the isolated worktree had no dependencies; `bun install --frozen-lockfile` restored the locked workspace environment before green verification.

## Verification

- Focused Core: `bun test test/plugin.test.ts` and `bun test test/plugin-package.test.ts` - 4 and 24 passed.
- Full Core: `bun test` - 1314 passed across 144 files.
- Focused/full server: `bun test test/plugin-package.test.ts` / `bun test` - 4 passed.
- Typechecks: Core, server, and CLI `bun run typecheck` - passed.

## Concerns

None.
