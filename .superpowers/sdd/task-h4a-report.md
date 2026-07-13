# Task H4A Follow-up Report

## Status

Complete. This follow-up hardens commit `3f7fd11637` without amending it.

## RED Evidence

- The original focused suites passed before the follow-up (`Core: 18`, `CodeMode: 42`), confirming the gaps were not covered.
- Added durable encoding regressions. `function tool calls retain the V1 persisted shape` failed because function calls were written as `session.next.tool.called.2`.
- Added V2 schema regressions. The current V2 schema accepted function kinds and object input instead of requiring a raw custom call.
- Core typecheck later caught an unsafe V1 projection cast after the first implementation pass.

## GREEN Evidence

- Focused Core H4A regressions: `25 pass`, `0 fail`.
- Full Core suite: `1147 pass`, `0 fail`.
- Full CodeMode suite: `254 pass`, `0 fail`.
- Core typecheck: `bun run typecheck` passed.
- CodeMode typecheck: `bun run typecheck` passed.

## Changes

- Applied exact limits: `timeoutMs: 120_000`, `maxToolCalls: 64`, `maxOutputBytes: 1_048_576`.
- Changed nested IDs to `${outerCallID}/${index}` and added exact assertions.
- Required `toolType: "custom"` before dispatching `exec`.
- Added custom-only `Tool.Called` V2 encoding with raw string input while preserving V1 function encoding, decoding, and projection.
- Made synchronized event commit/replay resolve the codec by the event's durable version.
- Extended tests for limits, IDs, kind rejection, V1 replay/projection, V1 function persistence, and V2 custom schema rejection.

## Files

- `packages/core/src/event.ts`
- `packages/core/src/session/event.ts`
- `packages/core/src/session/message-updater.ts`
- `packages/core/src/session/runner/publish-llm-event.ts`
- `packages/core/src/tool/registry.ts`
- `packages/core/test/session-projector.test.ts`
- `packages/core/test/session-runner-tool-events.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/session-tool-progress.test.ts`
- `packages/core/test/tool-codemode.test.ts`
- `.superpowers/sdd/task-h4a-report.md`

## Brief Audit

- Direct Core workspace dependency, immutable materialization, captured settlement, function-mode compatibility, explicit plans, exposure modes, grammar, instructions, and deterministic discovery remain intact.
- Nested settlement still preserves canonical names, permissions, stale-registration protection, sanitized failures, output bounding, interruption, managed paths, media aggregation, fixed inner concurrency, serialized outer execution, and bounded semantic progress.
- Apply-patch and shell projections remain canonical at settlement and audit boundaries.
- Custom calls/results replay through V2 history; function calls retain their original V1 durable shape and stored V1 events replay through the current projector.
- No model-name selection, prompts, Responses Lite selection, subagents, MCP/plugins, migration, or V1 runtime integration was added.

## Self-review

- V2 durable decoding now rejects mismatched custom/object and function/raw combinations rather than relying only on upstream LLM validation.
- Function calls continue to omit `toolType` durably, minimizing compatibility risk.
- Event version resolution is generic and uses the registered codec for the envelope version for both local publication and replay.
- Diff passes `git diff --check`; no unrelated files are included.

## Commit

Follow-up commit containing this report: `fix(core): harden CodeMode materialization`.

## Concerns

None known. Custom kind becomes durable at `Tool.Called`, which is the completed-call replay boundary required by the brief; transient input fragments remain live-only or V1-compatible.
