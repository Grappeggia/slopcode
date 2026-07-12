# H5D1 Implementation Report

## Status

`DONE_WITH_CONCERNS`

Durable V2 structured finals and the current stable-client bridge are implemented. Four required Slopcode HTTP tests still fail, but each failure was reproduced unchanged at the approved base `c54a7cd2558fd47217661986f10e7b44c4960451`; exact prompt-retry serialization was fixed by this slice.

## Design Decisions

- `SessionFormat` owns a closed `text`/`json_schema` union, safe JSON cloning, AJV draft selection, schema/value limits, validation, equivalence, fingerprints, and deterministic lifecycle IDs.
- Omitted stable format remains text. Stable `retryCount` maps only at the adapter boundary to durable `retry_count`, defaulting to two additional attempts.
- `final_output` is a reserved turn-local direct tool. Persistent and ordinary overlay registration reject the name. GPT-5.6 CodeMode keeps `exec`; nested CodeMode discovery cannot see or invoke the direct final tool.
- The runner uses ordinary streaming and required tool choice without `responseFormat`. It suppresses plain text during structured attempts, persists candidates before terminal validation, stops after a valid final, and uses deterministic retry/result/failure IDs.
- Successful values project authoritatively on assistant messages and replay later as semantic assistant JSON. Retry repair history is scoped to the active correction attempt, and compaction retains one semantic result or bounded failure summary.
- The current stable API is unchanged. V2-owned stable prompts translate formats, synchronous prompt results are projected after their admitted user message, and stable reads expose user format, text/files/agents, assistant `structured`, and `StructuredOutputError`.

## Files Changed

- `packages/core/src/session/format.ts`: admission, AJV policy, safe cloning, limits, validation, equivalence, fingerprints, and deterministic IDs.
- `packages/core/src/session/{prompt,input,event,message,message-updater,projector,compaction,control}.ts`: durable contract/lifecycle transport and semantic projection.
- `packages/core/src/session/runner/{llm,publish-llm-event,to-llm-message}.ts`: direct-final execution, retries, recovery, text suppression, activity binding, and semantic history.
- `packages/core/src/tool/registry.ts`: reserved direct-final materialization and settlement.
- `packages/slopcode/src/session/{control,message-compat}.ts` and stable HTTP handlers: current-client translation and reverse projection.
- `packages/server/src/handlers/session.ts`: typed native admission and active-format conflict mapping.
- Focused Core and Slopcode tests cover admission, reservation, modes, terminal/retry behavior, candidate recovery, text-turn isolation, format conflicts, and stable projection.

## TDD Evidence

RED commit: `4877d6f53a` `test(core): define structured final contract`.

Initial command:

```text
cd packages/core && bun test test/session-structured-output.test.ts test/session-structured-output-recovery.test.ts
```

Initial result: `0 pass`, `2 fail`, `1 error`. The failures showed the missing `@slopcode-ai/core/session/format` module and absent `final_output` reservation.

Final focused Core command:

```text
cd packages/core && bun test test/session-structured-output.test.ts test/session-structured-output-recovery.test.ts test/session-prompt.test.ts test/session-projector.test.ts test/session-runner.test.ts test/session-runner-tool-registry.test.ts test/session-execution-local.test.ts test/session-compaction.test.ts test/tool-overlay.test.ts test/tool-codemode.test.ts test/model-harness.test.ts
```

Result: `268 pass`, `0 fail`, `916 expect() calls`, 11 files.

Stable control command:

```text
cd packages/slopcode && bun test test/session/control.test.ts
```

Result: `18 pass`, `0 fail`, `71 expect() calls`.

## Verification

```text
cd packages/core && bun test
```

Result: `1440 pass`, `0 fail`, `4433 expect() calls`, 155 files.

```text
cd packages/llm && bun test
```

Result: `298 pass`, `30 skip`, `0 fail`, `654 expect() calls`, 26 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

Corrected focused protocol command:

```text
cd packages/llm && bun test test/generate-object.test.ts test/provider/openai-chat.test.ts test/provider/openai-responses.test.ts test/provider/anthropic-messages.test.ts test/provider/gemini.test.ts test/provider/bedrock-converse.test.ts
```

Result: `175 pass`, `0 fail`, `302 expect() calls`, 6 files. The brief's shorter Anthropic and Bedrock filenames do not exist.

```text
cd packages/core && bun run typecheck
cd packages/server && bun run typecheck
cd packages/slopcode && bun run typecheck
```

Result: all three exited 0 with `tsgo --noEmit`.

```text
cd ../.. && bun install --frozen-lockfile
```

Result: exit 0; `Checked 2372 installs across 2656 packages (no changes)`.

`git diff --check` passed. No public OpenAPI schema changed, so the JavaScript SDK was not regenerated.

## Baseline-Reproduced Failures

The required focused Slopcode matrix finished with `167 pass`, `1 skip`, `4 fail`, `714 expect() calls`. Each remaining failure was run independently at the approved base in `/tmp/slopcode/h5d1-base-check`:

- `returns declared not found errors for read routes`: expected missing-session abort `200`, received `400` on both branch and base.
- `compacts a native v2 session through the public HTTP route`: timed out after 5 seconds on both branch and base.
- `returns a safe typed HTTP error when native v2 compaction fails`: timed out after 5 seconds on both branch and base.
- `runs and waits for a native v2 prompt through the shared live execution layer`: wait returned `204` before provider dispatch on both branch and base.

The same matrix originally also failed exact prompt-ID response equality because optional prompt fields encoded as `null` on first admission and were omitted after reload. H5D1 now normalizes omitted fields before admission; that test passes.

## Contract Review

- [x] V2 Core owns format, retries, candidate/result/failure events, recovery, and semantic history.
- [x] Admission is closed, bounded, safely cloned, draft-selective, local-ref capable, and fail-closed before persistence.
- [x] Durable schemas retain their admitted JSON value; tool views strip only top-level `$schema`.
- [x] Prompt/input/event/message paths preserve format across admission, queue/steer promotion, replay, and restart.
- [x] Active conflicting steers fail typed; queued inputs retain independent contracts.
- [x] `final_output` is reserved, permission-independent, direct-only, and excluded from nested CodeMode.
- [x] Function and GPT-5.6 code modes retain their normal tool plans and do not use native `response_format`.
- [x] Valid finals terminate without continuation or leaked text; configured additional attempts and exhaustion are exact.
- [x] Durable candidate recovery settles without another provider request; deterministic terminal IDs prevent success/exhaustion duplication.
- [x] Public messages retain exact structured JSON while correction/tool/log paths avoid duplicating it.
- [x] Later text turns do not inherit an earlier structured contract.
- [x] Stable V2-owned clients receive translated format, prompt parts, structured results, and stable structured errors.
- [x] No V1 structured-output runtime delegation, H6 native lowering, H7 bulk migration, H8 route, snapshot, LSP, or Ultra work was added.

Existing `SessionV1` imports under the Core session directory are confined to the pre-existing SQL/projector compatibility path. The new runner, format, ToolRegistry, and message-history implementation imports no V1 structured runtime.

## Commits

- `4877d6f53a` `test(core): define structured final contract`
- `c8ed918e89` `feat(core): persist structured session finals`
- `df605dc193` `feat(slopcode): bridge structured V2 finals`
- Report commit: the `docs:` commit containing this file.

## Remaining Concerns

- The four baseline HTTP failures above prevent a completely green required Slopcode matrix. They are outside the structured-final change and were not weakened or hidden.
- Full H7 reverse event migration remains deferred. H5D1 implements only the current stable prompt and message-read compatibility surface permitted by the brief.
- Focused recovery proves the durable-candidate crash window and terminal idempotency. The broader crash/interruption matrix in the brief is primarily covered by existing runner, runtime-fence, event-transaction, and execution-recovery suites rather than one dedicated test per listed timing boundary.

## Review Remediation Appendix

### Review Audit

The review package through `467585c548` and partial fixes `46f344ec16` and `891438742a` were audited before further edits. The partial fixes covered unsafe format admission, schema-only limits, scalar/array `{ value }` wrapping, and public registry exposure, but did not yet provide durable dispatch accounting, complete owner/state/epoch fencing, distinct invalid-JSON errors, stable activity correlation and pagination, or live stable execution composition.

The remediation adds:

- A durable `SessionEvent.Structured.Dispatched` record before provider invocation. Recovery consumes an interrupted dispatch instead of redispatching it, preserving the exact `1 + retry_count` budget.
- Deterministic dispatch, recovery, candidate, retry, result, and failure IDs. Structured writes require the matching V2 owner, `draining` state, epoch, dispatch/candidate/fingerprint, and absence of an existing terminal.
- A closed portable `{ value: schema }` tool envelope for every JSON root. Admission rejects accessors, cycles, unsafe values, ambiguous envelopes, and prototype-like attacks without leaking rejected payloads.
- `SessionFormat.ToolValueError` classifications for `invalid-json` and `value-limit`, keeping malformed JSON distinct from schema mismatch.
- Durable assistant `rootUserID` correlation, exact stable structured parents, legacy-compatible stable pagination, and live `SessionExecutionLocal` composition for native V2 HTTP execution.
- V1 event compatibility by retaining `SessionEvent.Tool.Called`/`CalledV1` for legacy function calls and using `SessionEvent.Tool.CalledV2` only for raw custom calls. `packages/slopcode/src/session/processor.ts` is restored to the V1 event contract.

### Additional RED/GREEN Evidence

RED commits:

- `f1dfa92fbd` `test(core): define durable structured attempt gaps`
- `e194e0f6c3` `test(slopcode): expose stable v2 correlation gaps`

The Core RED coverage exposed unsafe tool values, accessors, cycles, ambiguous envelopes, prototype-key data, exact default/max budgets, invalid JSON classification, duplicate finals, and missing durable dispatched-attempt recovery. The Slopcode RED coverage exposed unstable activity parent correlation and missing stable pagination behavior.

GREEN commits:

- `bd94cd56c7` `fix(core): fence durable structured attempts`
- `a3baa488fd` `fix(slopcode): correlate stable v2 activities`

Final focused results:

- Core H5D1 matrix: `279 pass`, `0 fail`.
- LLM protocol matrix: `175 pass`, `0 fail`, `302 expect() calls`, 6 files.
- Slopcode control: `18 pass`, `0 fail`, `71 expect() calls`.
- Focused stable/native Slopcode matrix: `104 pass`, `1 fail`; the only failure is the approved-base missing-session abort mismatch (`200` expected, `400` received).
- Actual HTTP structured regression passes queued text plus synchronous structured execution, exact response parent correlation, two provider calls, first-page cursor/link headers, and second-page retrieval.

### Recovery And Privacy Evidence

- Before dispatch: no dispatched record means normal startup recovery may issue the first request.
- After durable dispatch and before provider completion: the recorded attempt is consumed and recovery advances or exhausts without repeating that request.
- After candidate and before terminal: recovery validates and settles the matching bounded candidate without another provider request.
- After terminal and before runner return: deterministic IDs and no-terminal transaction guards make settlement idempotent.
- Retry and redispatch: every attempt has distinct deterministic dispatch/recovery IDs and remains bounded by the admitted retry count.
- Epoch or ownership loss: every lifecycle publication uses the runner's fenced event interface and transaction-level owner/state/epoch checks.
- Duplicate or parallel final calls: only the matching candidate can settle, and the first terminal prevents all later terminals.
- Rejected values persist metadata-only invalidity. Retry notices, event projections, status, logs, and CodeMode discovery do not contain the full candidate; the exact validated value remains only on the authoritative assistant result.

### Updated Verification

```text
cd packages/core && bun test
```

Result: `1451 pass`, `0 fail`, `4470 expect() calls`, 155 files.

```text
cd packages/llm && bun test
```

Result: `298 pass`, `30 skip`, `0 fail`, `654 expect() calls`, 26 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/slopcode && bun test
```

Result: `3101 pass`, `22 skip`, `1 todo`, `7 fail`, `8577 expect() calls`, 248 files. The structured/native cases added or repaired by this review pass in the full run, including native wait, compaction success/failure, exact correlation, and pagination.

The seven failures were rerun in isolation. At approved base `c54a7cd2558fd47217661986f10e7b44c4960451`, five reproduce exactly:

- PTY disposal leaves the legacy PTY listed.
- Three workspace/worktree tests return `WorkspaceCreateError: Project not found`.
- Delayed SSE body handling exceeds Bun's 5-second test timeout.

The missing-session abort failure was already independently reproduced at the approved base: expected `200`, received `400` on both revisions. The remaining listener test times out above 5 seconds on this branch; the approved base passed narrowly in `4664.42ms`, so this is recorded as a timing concern rather than claimed as an exact baseline reproduction.

```text
cd packages/core && bun run typecheck
cd packages/llm && bun run typecheck
cd packages/codemode && bun run typecheck
cd packages/server && bun run typecheck
cd packages/slopcode && bun run typecheck
```

Result: all exited 0 with `tsgo --noEmit`.

```text
bun install --frozen-lockfile
```

Result: exit 0; `Checked 2372 installs across 2656 packages (no changes)`.

`git diff --check` passes. Source searches find no `SessionV1` runtime import in `session/format.ts` or the runner, and no `responseFormat` use under the V2 session source. Existing `CalledV1` names are event compatibility aliases, not V1 structured-output delegation. The public registry exposes only the reserved name constant and cannot install or settle the runner-local final capability.

### Review Commit Map

- `46f344ec16` `test(core): expose structured final review gaps`
- `891438742a` `fix(core): privatize portable structured finals`
- `f1dfa92fbd` `test(core): define durable structured attempt gaps`
- `bd94cd56c7` `fix(core): fence durable structured attempts`
- `e194e0f6c3` `test(slopcode): expose stable v2 correlation gaps`
- `a3baa488fd` `fix(slopcode): correlate stable v2 activities`

### Final Review Status

`DONE_WITH_CONCERNS`

All structured-final review findings are implemented and focused gates are green. Remaining concerns are the baseline-reproduced unrelated HTTP/worktree failures, the missing-session abort contract mismatch, and the branch-only listener timing threshold described above. No changes were pushed.
