# Task H4B Report

## Status

DONE. The GPT-5.6 profiles now activate the V2 runner, CodeMode, pinned instructions, Responses Lite, profile reasoning policy, and executable context limit without changing unrelated models.

## Commits

- `636f6b6cd2 feat(core): activate GPT-5.6 V2 harness`
- `63b10511d4 test(core): deduplicate GPT-5.6 harness coverage`

H1-H4A commits remain intact. Nothing was pushed.

## Source And Hash Validation

- Public source: `openai/codex` commit `bfe31598c79bd2e5b9089030ae7f2978457015c8`.
- Source path: `codex-rs/models-manager/models.json`.
- Downloaded source SHA-256: `58852101e0de20048bd9878a48fa78f6040c89628d0b0a421d080da47e7f03e6`.
- Local `gpt-5.6-sol-v1` SHA-256: `e9778714d505f3dd04d44db4394024c5fab5bf6554fc9faa3cdf9cf776b63bb9`.
- Local `gpt-5.6-general-v1` SHA-256: `78a2fc84e1bffa421d865c1a2ade4185d3d33ef38e6a15157f0ff1a89b7d52ec`.
- Terra and Luna resolve the same general template. There is no runtime fetch or remote fallback.

Validation command:

```sh
sha256sum packages/core/src/model-harness-gpt-5.6-sol-v1.txt \
  packages/core/src/model-harness-gpt-5.6-general-v1.txt \
  /tmp/slopcode/codex-models-bfe31598.json
```

## TDD Evidence

RED failures established the missing behavior before implementation:

- `ModelHarness.instructions` and `ModelHarness.reasoning` did not exist.
- Harnessed context remained at the catalog's `1,050,000` tokens.
- OpenAI-compatible Chat resolved instead of returning `ModelHarness.IncompatibilityError`.
- `ultra` reached the OpenAI wire unchanged.
- The V2 runner did not activate CodeMode, pinned prompt ordering, Lite options, or child progress.

GREEN verification:

- Focused Core harness/model tests: `21 pass`, `0 fail`.
- Deduplicated V2 runner suite: `112 pass`, `0 fail`.
- Focused OpenAI Responses suite: `67 pass`, `0 fail`.
- Full Core suite: `1170 pass`, `0 fail`.
- Full LLM suite: `297 pass`, `30 skip`, `0 fail`.
- Core typecheck: `bun run typecheck` passed.
- LLM typecheck: `bun run typecheck` passed.
- `git diff --check` passed.

All tests were run from `packages/core` or `packages/llm`, never from the repository root.

## Behavior

- Versioned local prompt assets are resolved through `ModelHarness.instructions(profile)` and hash-checked as defects.
- OpenAI Responses declares typed `responses-lite`; Core contributes `code-mode`. Missing capabilities fail closed before streaming.
- Profile tool plans materialize one custom `exec` tool with shell and freeform patch projections; unrelated models retain function tools.
- Child progress publishes through the turn-fenced event interface under the outer exec call with counts and redacted name/outcome only.
- Profiled system order is pinned instructions, explicit agent addition, then durable baseline. Lite lowers that order into developer content.
- Profiled requests use Lite, low verbosity, prompt cache keys, no default reasoning summary, and profile default or validated explicit effort.
- `ultra` remains an explicit profile option and lowers to provider wire effort `max`; no H5 delegation was added.
- Lite continues to own parallel false and all-turns reasoning in the LLM protocol.
- Executable context is `372000`; catalog output limits and encrypted reasoning continuation/store defaults remain intact.
- HTTP Responses remains selected. WebSocket preference is retained in profile metadata for H6 only.

## Files

- `packages/core/src/model-harness-gpt-5.6-sol-v1.txt`
- `packages/core/src/model-harness-gpt-5.6-general-v1.txt`
- `packages/core/src/model-harness.ts`
- `packages/core/src/session/runner/llm.ts`
- `packages/core/src/session/runner/model.ts`
- `packages/core/test/model-harness.test.ts`
- `packages/core/test/session-runner-model.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/llm/src/protocols/openai-responses.ts`
- `packages/llm/src/protocols/utils/openai-options.ts`
- `packages/llm/src/providers/openai-options.ts`
- `packages/llm/src/providers/openai.ts`
- `packages/llm/src/route/client.ts`
- `packages/llm/src/route/protocol.ts`
- `packages/llm/test/provider/openai-responses.test.ts`
- `.superpowers/sdd/task-h4b-report.md`

## Self-Review

- Capability detection is protocol-owned rather than inferred from provider names or transport headers.
- Unsupported profiled routes cannot fall back to classic tools or another transport.
- Reasoning summary `none` replaces inherited `auto` without changing encrypted continuation, include, or store behavior.
- Prepared Lite JSON omits top-level tools and summary, keeps top-level instructions empty, and preserves ordered developer content.
- Unprofiled full/function request shape and legacy system order are covered by a runner golden.
- No V1 prompt, feature flag, MCP/plugin/subagent, migration, WebSocket fallback, provider convergence, or H5+ behavior changed.

## Concerns

None known. Live GPT-5.6 provider execution was not required; the real V2 session path is validated through the typed prepared OpenAI body and existing transport tests.
