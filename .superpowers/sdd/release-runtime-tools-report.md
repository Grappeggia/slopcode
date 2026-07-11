# Release Runtime/Tools Review Report

Status: DONE

## Changes

- Fenced prompt, model, interrupt, compact, shell, agent, and skill mutations with owner/state/epoch guards inside their EventV2 transaction commit.
- Made task cancellation/orphan checks fail closed for malformed ownership and absent or malformed canonical origins, preventing damaged children from startup or provider execution.
- Added recovery-only tolerant task-origin lookup so a deterministic request ID occupied by another event type is orphaned safely while strict callers still defect.
- Restored strict Task.Requested payload decoding while keeping wrong-type, corrupt, and missing origins tolerant only in recovery fencing.
- Bound canonical task ownership to the child row parent, immutable owner origin, and current resume request before orphan/cancellation decisions.
- Fenced exact prompt/skill/shell/compaction retries and same-agent no-ops in immediate transactions before any wake or return.
- Rechecked the runtime guard after prompt, shell, and compaction publish-defect collision recovery before returning the winning record.
- Moved Responses Lite/custom-tool capabilities to explicit OpenAI HTTP/WebSocket deployments and rejected unsupported requests on Azure, xAI, and GitHub Copilot routes.
- Resolved every model destination before publishing a switch and checked custom-tool compatibility against active post-compaction history only.

## RED Coverage

- Deterministic EventV2 commit hooks transition runtime state immediately before each control commit and assert typed rejection with no durable mutation.
- Every control independently covers owner, state, and epoch-only commit races from ready V2 state; retry tests transition after initial assertion but before existing-record lookup.
- Fresh, exact-retry, and collision fixtures use owner-only and state-only updates without epoch changes, plus independent epoch-only updates.
- Damaged/fabricated task fixtures assert fail-closed cancellation/orphaning and zero child provider runs during recovery.
- Wrong-type deterministic request fixtures assert strict lookup failure, safe startup/listener handling, orphaning, and zero child provider runs.
- A correctly typed Task.Requested event corrupted to schema-invalid data remains fail-closed through startup and live listener execution without provider work.
- Strict corrupt-request lookup defects, while parent-row and request-origin mismatch children remain orphaned/cancelled with zero provider runs.
- Route matrix/request tests assert non-OpenAI Responses deployments reject Lite/custom requests while explicit OpenAI routes retain support.
- Model-switch tests cover unsupported destinations, active custom history across Anthropic/Gemini/Bedrock/OpenAI Chat, compatible Responses, and compacted-away custom history.

## Verification

- Focused Core runtime/tools tests: 46 passed.
- Full Core: 1317 passed, 0 failed.
- Focused LLM Responses/route: 69 passed, 0 failed.
- Full LLM: 298 passed, 30 skipped, 0 failed.
- Core, LLM, and server typechecks: passed.

## Concerns

None.
