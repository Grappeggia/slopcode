# Release Host Control Report

## Status

DONE_WITH_CONCERNS

## Implemented

- Routed Slopcode V2 prompt and interrupt through Core `SessionControl`, preserving the V1 `SessionPrompt` path and Core's ready/owner/epoch commit guard.
- Added deterministic paused, draining, migrating, and owner/state/epoch TOCTOU tests proving the guarded V2 prompt/interrupt mutations do not occur.
- Fenced V1 prompt and cancel routing on persisted V1 ownership, ready state, and observed epoch; `SessionPrompt` now reruns a generic guard before cleanup/message persistence and immediately before cancellation.
- Made `SessionV2.interrupt` execute its supplied guard before interrupting when projection state is absent, with real Core and Slopcode facade projector-race coverage.
- Installed scoped `PluginPackage.Host` layers in Slopcode's in-process and listener server compositions, with configured SDK transport, actual listener URL, auth injection, and no standalone server runtime.
- Bridged package workspace registrations into the production adapter registry with token-owned cleanup on location/host scope disposal.
- Isolated `Server.Default()` from the shared HTTP memo map and covered direct authenticated in-process SDK requests, non-recursive package loading, production adapter registration, location invalidation, and default-scope disposal.
- Snapshotted each listener's environment once for both route configuration and internal plugin SDK authentication, without relying on module-load flags.
- Gave `Server.Default()` a stable in-process URL and made listeners clear only their own exported URL on shutdown.
- Preserved standalone `@slopcode-ai/server` host behavior while adding an optional production registry bridge.

## RED Evidence

- `bun test test/session/control.test.ts`: failed before implementation because the Slopcode facade had no Core `SessionControl` service and still required direct `SessionV2` access.
- `bun test test/server/plugin-package-production.test.ts`: failed before implementation with missing `LocationServiceMap`; after host installation it exposed dropped `RequestInit` and recursive secondary-runtime transport before the final listener transport fix.
- Review follow-up: the Core and facade projector-race interrupt tests failed because `SessionV2.interrupt` called execution before its guard when `SessionStore.get` returned no projection.
- Review follow-up: the `Server.Default()` production test resolved `PluginPackage.unavailable` because its shared memo map reused an unhosted location composition.
- Review follow-up: V1 TOCTOU tests mutated owner/state/epoch after route selection and showed legacy prompt/cancel mutation proceeding without a boundary guard.
- Review follow-up: env-only listener auth left internal plugin SDK calls unauthorized because the host read stale `Flag` values.
- Review follow-up: listener shutdown left the dead listener URL globally visible, and Default package inputs inherited it.

## Verification

- PASS: `packages/slopcode`: `bun test test/session/control.test.ts test/control-plane/adapters.test.ts test/server/plugin-package-production.test.ts` (17 pass).
- PASS: `packages/slopcode`: guarded persistence case in `test/session/prompt.test.ts` (1 pass); full file completed with 51 pass, 1 skip, and only 4 previously classified failures.
- PASS: `packages/server`: `bun test` (4 pass).
- PASS: `packages/core`: `bun test test/session-prompt.test.ts test/session-agent-skill.test.ts` (49 pass).
- PASS: `packages/slopcode`: `bun test test/server/httpapi-listen.test.ts` (10 pass).
- PASS: `packages/server`: `bun run typecheck`.
- PASS: `packages/core`: `bun run typecheck`.
- PASS: repository `git diff --check`.
- FULL SUITE: `packages/slopcode`: `bun test` (3059 pass, 22 skip, 1 todo, 11 fail). All 11 named failures also fail at base commit `8389b8fbac`; eight reproduce with the same assertion/timeout, while the three native V2 HTTP tests fail earlier there because `LocationServiceMap` is absent. No listed pass/fail regression is caused by the host-control commits.
- TYPECHECK: `packages/slopcode`: `bun run typecheck` reaches two existing errors in untouched files: `src/session/processor.ts:495` (`Record<string, unknown>` to `string`) and `src/session/prompt.ts:1147` (missing `actualState` in a constructed runtime mismatch).

## Concerns

- The branch-wide Slopcode test suite and Slopcode typecheck are not green because of the unrelated failures listed above. All affected release-host/control tests, Core mutation tests, standalone server tests, and the other affected package typechecks pass.
- The existing PTY listener smoke remains near its timeout threshold, although the latest isolated listener file run passed all 10 tests.
