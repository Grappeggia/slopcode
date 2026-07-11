# Release Runtime/Tools Review Report

Status: DONE

## Changes

- Fenced prompt, model, interrupt, compact, shell, agent, and skill mutations with owner/state/epoch guards inside their EventV2 transaction commit.
- Made task cancellation/orphan checks fail closed for malformed ownership and absent or malformed canonical origins, preventing damaged children from startup or provider execution.
- Moved Responses Lite/custom-tool capabilities to explicit OpenAI HTTP/WebSocket deployments and rejected unsupported requests on Azure, xAI, and GitHub Copilot routes.
- Resolved every model destination before publishing a switch and checked custom-tool compatibility against active post-compaction history only.

## RED Coverage

- Deterministic EventV2 commit hooks transition runtime state immediately before each control commit and assert typed rejection with no durable mutation.
- Damaged/fabricated task fixtures assert fail-closed cancellation/orphaning and zero child provider runs during recovery.
- Route matrix/request tests assert non-OpenAI Responses deployments reject Lite/custom requests while explicit OpenAI routes retain support.
- Model-switch tests cover unsupported destinations, active custom history across Anthropic/Gemini/Bedrock/OpenAI Chat, compatible Responses, and compacted-away custom history.

## Verification

- Focused Core runtime/tools tests: 107 passed.
- Full Core: 1314 passed, 0 failed.
- Focused LLM Responses/route: 69 passed, 0 failed.
- Full LLM: 298 passed, 30 skipped, 0 failed.
- Core, LLM, and server typechecks: passed.

## Concerns

None.
