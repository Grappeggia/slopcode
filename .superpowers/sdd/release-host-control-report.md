# Release Host Control Report

## Status

DONE_WITH_CONCERNS

## Implemented

- Routed Slopcode V2 prompt and interrupt through Core `SessionControl`, preserving the V1 `SessionPrompt` path and Core's ready/owner/epoch commit guard.
- Added deterministic paused, draining, migrating, and owner/state/epoch TOCTOU tests proving the guarded V2 prompt/interrupt mutations do not occur.
- Installed scoped `PluginPackage.Host` layers in Slopcode's in-process and listener server compositions, with configured SDK transport, actual listener URL, auth injection, and no standalone server runtime.
- Bridged package workspace registrations into the production adapter registry with token-owned cleanup on location/host scope disposal.
- Preserved standalone `@slopcode-ai/server` host behavior while adding an optional production registry bridge.

## RED Evidence

- `bun test test/session/control.test.ts`: failed before implementation because the Slopcode facade had no Core `SessionControl` service and still required direct `SessionV2` access.
- `bun test test/server/plugin-package-production.test.ts`: failed before implementation with missing `LocationServiceMap`; after host installation it exposed dropped `RequestInit` and recursive secondary-runtime transport before the final listener transport fix.

## Verification

- PASS: `packages/slopcode`: `bun test test/session/control.test.ts test/control-plane/adapters.test.ts test/server/plugin-package-production.test.ts` (10 pass).
- PASS: `packages/server`: `bun test` (4 pass).
- PASS: `packages/core`: `bun test test/session-prompt.test.ts test/session-agent-skill.test.ts` (48 pass).
- PASS: `packages/server`: `bun run typecheck`.
- PASS: `packages/core`: `bun run typecheck`.
- PASS: repository `git diff --check`.
- FULL SUITE: `packages/slopcode`: `bun test` (3059 pass, 22 skip, 1 todo, 11 fail). The same 11 failures reproduce when their five files are run alone and are outside the changed paths: snapshot/tool processing, legacy prompt/tool continuation, native V2 HTTP compaction/wait timing, and provider header timeout.
- TYPECHECK: `packages/slopcode`: `bun run typecheck` reaches two existing errors in untouched files: `src/session/processor.ts:495` (`Record<string, unknown>` to `string`) and `src/session/prompt.ts:1147` (missing `actualState` in a constructed runtime mismatch).

## Concerns

- The branch-wide Slopcode test suite and Slopcode typecheck are not green because of the unrelated failures listed above. All affected release-host/control tests, Core mutation tests, standalone server tests, and the other affected package typechecks pass.
