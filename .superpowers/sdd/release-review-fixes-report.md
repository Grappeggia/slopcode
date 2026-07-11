# Release Review Fixes Report

Status: DONE

## Findings Closed

- Native session mutations now pass through `SessionControl`; owner and `ready` state are checked with typed `SessionRuntime.Mismatch` errors before admission or event mutation. Native V1, draining, migrating, and paused coverage verifies prompt, skill, agent, model, and interrupt controls leave events, inputs, and model projection unchanged.
- Durable session decoding now version-refines both `Tool.CalledV1` and `Tool.Called`, preserving historical function calls and current custom calls in public replay order and message projection.
- Model switching now inspects persisted assistant history and resolves the destination route before mutation. Routes without the typed `custom-tools` capability fail with `Session.ModelHistoryIncompatibleError`; Anthropic Messages, Gemini, Bedrock Converse, and OpenAI Chat reject GPT-5.6 custom-call/result history, while OpenAI Responses and sessions without custom history remain switchable.
- Configured workspace registrations now have per-factory cleanup ownership. Server storage keeps token stacks per project/type, stale cleanup cannot remove a replacement, empty replacement removes the prior adapter, and cleanup runs on factory/adaptation failure, replacement/removal, slow disposal, Location/server scope closure, and web-handler disposal.

## RED Evidence

- `cd packages/core && bun test test/public-slopcode.test.ts test/session-create.test.ts`
  - Initial result: 32 passed, 3 failed.
  - Reproduced native V1 prompt admission, missing V1 function-call replay, and successful incompatible model switch.
- `cd packages/server && bun test test/plugin-package.test.ts`
  - Initial result: 0 passed, 2 failed.
  - Reproduced retained adapter after web-handler disposal and missing registration cleanup callback.

## GREEN Evidence

- Focused Core release regressions: `cd packages/core && bun test test/public-slopcode.test.ts test/session-create.test.ts test/plugin-package.test.ts test/location-layer.test.ts`
  - 61 passed, 0 failed, 212 assertions.
- Core plugin lifecycle after final disposal adjustment: `cd packages/core && bun test test/plugin-package.test.ts test/location-layer.test.ts`
  - 26 passed, 0 failed, 85 assertions.
- Core full: `cd packages/core && bun test --only-failures`
  - 1309 passed, 0 failed, 3787 assertions across 144 files.
- CodeMode full: `cd packages/codemode && bun test`
  - 254 passed, 0 failed, 744 assertions.
- Server full: `cd packages/server && bun test`
  - 3 passed, 0 failed, 13 assertions, including explicit Location invalidation and web-handler disposal.
- Slopcode affected suites: `cd packages/slopcode && bun test test/plugin/workspace-adapter.test.ts test/session/control.test.ts`
  - 3 passed, 0 failed, 12 assertions.
- LLM full: `cd packages/llm && bun test`
  - 297 passed, 30 skipped recorded/credential-dependent cases, 0 failed, 643 assertions.
- Typechecks:
  - `cd packages/core && bun run typecheck`: passed.
  - `cd packages/server && bun run typecheck`: passed.
  - `cd packages/cli && bun run typecheck`: passed.
  - `cd packages/llm && bun run typecheck`: passed.
- Frozen install: `bun install --frozen-lockfile`
  - Passed; 2372 installs checked, no changes.
- Diff integrity: `git diff --check`
  - Passed with no output.

## Scope

- Preserved V1 event decoding and existing H5C3B plugin isolation/disposal semantics.
- Added only the current custom-history compatibility guard; no migration or provider-convergence work was introduced.
- No push was performed.
