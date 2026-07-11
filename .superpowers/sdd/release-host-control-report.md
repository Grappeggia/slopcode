# Release Host Control Report

## Status

DONE_WITH_CONCERNS

## Implemented

- Routed Slopcode V2 prompt and interrupt through Core `SessionControl`, preserving the V1 `SessionPrompt` path and Core's ready/owner/epoch commit guard.
- Added deterministic paused, draining, migrating, and owner/state/epoch TOCTOU tests proving the guarded V2 prompt/interrupt mutations do not occur.
- Added a deterministic internal V1 `PromptAdmitted` event as the first prompt effect; its synchronized transaction validates owner, ready state, and epoch before MCP/read/plugin/filesystem work, and all later writes belong to that admission.
- Made exact admission retries durable and idempotent by session/message/identity, rejected conflicting identities, and serialized concurrent same-ID preparation without duplicate side effects.
- Added an immediate-transaction `SessionRuntime.claim` as the V1 cancellation linearization point; it executes `SessionRunState.cancel` as its coordinate before runtime ownership/state/epoch assignments can commit.
- Made guarded missing-projection `SessionV2.interrupt` validate and return without calling execution, while preserving unguarded missing-session interruption compatibility.
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
- Final atomicity follow-up: pausing V1 prompt admission after its guard let owner/state/epoch transitions complete before the first message projection.
- Final atomicity follow-up: the V1 cancellation regression initially failed because no transactional runtime claim API existed.
- Final atomicity follow-up: a successful guarded missing-projection V2 interrupt still called `SessionExecution.interrupt`.
- Precise linearization follow-up: transition-wins tests failed because revert cleanup and agent/model projections mutated before guarded admission; coordinated cancellation failed because `state.cancel` ran after `SessionRuntime.claim` returned.
- Durable admission follow-up: post-guard MCP/plugin preparation could run before the guarded message write; RED tests timed out waiting for a durable admission event and showed exact/conflicting retries rerunning preparation and replacing the message.

## Verification

- PASS: `packages/slopcode`: `bun test test/session/control.test.ts test/control-plane/adapters.test.ts test/server/plugin-package-production.test.ts` (17 pass).
- PASS: `packages/slopcode`: twelve durable admission guard/race/retry regressions in `test/session/prompt.test.ts` (12 pass); full file completed with 62 pass, 1 skip, and only 4 previously classified failures.
- PASS: `packages/slopcode`: `bun test test/session/control.test.ts` (16 pass), including coordinated cancellation and concurrent owner/state/epoch ordering.
- PASS: `packages/slopcode`: `bun test test/session/revert-compact.test.ts` (7 pass), including cleanup compatibility.
- PASS: `packages/core`: guarded missing-projection V2 interrupt regression (1 pass).
- PASS: `packages/core`: `bun test test/event.test.ts test/session-prompt.test.ts` (81 pass), including exact EventV2 deduplication and conflict rejection.
- PASS: `packages/server`: `bun test` (4 pass).
- PASS: `packages/core`: `bun test test/session-prompt.test.ts test/session-agent-skill.test.ts` (49 pass) from the preceding host-control verification.
- PASS: `packages/slopcode`: `bun test test/server/httpapi-listen.test.ts` (10 pass).
- PASS: `packages/server`: `bun run typecheck`.
- PASS: `packages/core`: `bun run typecheck`.
- PASS: repository `git diff --check`.
- FULL SUITE: `packages/slopcode`: `bun test` (3059 pass, 22 skip, 1 todo, 11 fail). All 11 named failures also fail at base commit `8389b8fbac`; eight reproduce with the same assertion/timeout, while the three native V2 HTTP tests fail earlier there because `LocationServiceMap` is absent. No listed pass/fail regression is caused by the host-control commits.
- TYPECHECK: `packages/slopcode`: `bun run typecheck` reaches two existing errors: `src/session/processor.ts:495` (`Record<string, unknown>` to `string`) and pre-existing runtime mismatch construction in `src/session/prompt.ts:1224` (missing `actualState`; shifted by these changes).

## Concerns

- The branch-wide Slopcode test suite and Slopcode typecheck are not green because of the unrelated failures listed above. All affected release-host/control tests, Core mutation tests, standalone server tests, and the other affected package typechecks pass.
- The existing PTY listener smoke remains near its timeout threshold, although the latest isolated listener file run passed all 10 tests.
