# Final Whole-Branch Fixes Report

## Outcome

All four final review blockers were fixed on `feat/btw-followups` in the isolated
`/tmp/slopcode/btw-followups` worktree.

- Implementation commit: `1c1d54f666ba682a3ed959891bb7e357d342c768`
  (`fix(session): isolate and bound btw requests`)
- Conservative context follow-up: `3952092b1c481ac3cdbf3c69898d55d18e88ac2e`
  (`fix(session): make btw context bounds conservative`)
- No existing commit was amended.
- The JavaScript SDK was regenerated with the repository script. The schema constraints do not alter TypeScript shapes, so generation produced no additional tracked SDK diff.

## Root Causes And Fixes

### 1. GitLab workflow isolation

Root cause:

- `Provider.getLanguage()` caches one language-model object per provider/model.
- `LLM.run()` detected `GitLabWorkflowLanguageModel` only after obtaining that shared object, then assigned request-specific `sessionID`, `systemPrompt`, `toolExecutor`, `sessionPreapprovedTools`, and `approvalHandler` directly onto it.
- A `/btw` request therefore installed its private reader and normal workflow approval handler on the same mutable object used by a main request. The side event filter rejected provider-hosted results only after provider execution, which was too late to prevent hosted tools, permission prompts, or races.

Fix:

- Added an internal `runtime: "side"` request mode at the LLM request/runtime boundary.
- Side mode requires exactly one executable tool named `read` and automatic tool choice before provider preparation.
- A real `GitLabWorkflowLanguageModel` is rejected with a clear side error immediately after language selection and before any workflow state, executor, preapproval, or approval handler is mutated.
- Non-workflow side requests retain only the request-local private reader. Registry, MCP, plugin tool definitions, edit/write/shell tools, and hosted workflow executors are never installed.
- The regression preserves sentinel main-request state on the cached workflow object and proves its `doStream()` provider seam is never called.

### 2. Permission precedence and cross-session isolation

Root cause:

- `Permission.query()` appended the instance-global remembered approval list after the selected agent and persisted session rules.
- Because the evaluator is last-match-wins, an approval remembered in session A could turn an explicit persisted `ask` or `deny` into `allow` for `/btw` in session B.

Fix:

- The non-mutating `query()` path now evaluates only the caller-supplied persisted ruleset.
- Normal `Permission.ask()` explicitly evaluates the same rules plus remembered approvals, preserving existing normal prompt behavior.
- Cross-session tests remember a normal approval, prove side queries still resolve explicit `ask` and `deny`, prove no pending request or event is created, and prove a normal ask still consumes the remembered approval.

### 3. Read resource alignment and existence hiding

Root cause:

- Side reads canonicalized and probed the target before checking `read` permission.
- They authorized only a canonical display resource, and references used `name:path`, while normal read authorization uses the requested worktree-relative path.
- Path-specific rules could therefore miss symlink/reference aliases, and error differences disclosed whether a denied target existed.

Fix:

- The first read decision uses the requested worktree-relative resource, matching normal read semantics, before target `realPath()`, existence, MIME, stat, or content work.
- After canonicalization, a distinct canonical worktree-relative alias must also independently resolve to `allow`.
- External references still require canonical `external_directory` permission in addition to both read decisions.
- Missing references, missing files, read ask/deny, canonical alias ask/deny, and external authorization failures use the same unavailable error where existence could otherwise leak.
- Descriptor-relative `O_NOFOLLOW` traversal, canonical containment, pinned inode identity, regular UTF-8 text checks, abort handling, atomic limits, and the exact five-unique-file allowance remain intact.

### 4. Hard context bounds

Root cause:

- Client turns had no count or text-size schema bound.
- All completed side turns were treated as fixed input even when they exceeded the selected model context.
- Mandatory main groups could overflow the prior heuristic, and no check ran before provider continuations containing private read output.
- The repository's normal four-characters-per-token estimate is useful for compaction but is not a safe upper bound for Unicode or high-entropy side input.

Fix:

- Requests accept at most 32 completed turns and 64,000 characters per current question, prior question, or prior answer. The service repeats these checks for direct callers that bypass HTTP decoding.
- Side budgeting includes the effective agent/provider system prompt, environment and project instructions, current question, model messages, and the private read tool schema.
- Accounting uses serialized UTF-8 bytes as a conservative token upper bound, plus fixed and per-message/tool framing reserves.
- The usable input budget is capped by the selected model's context/input limits and prepared output-token allowance.
- The current question is mandatory. Completed side turns are retained as a contiguous newest suffix before main history. The latest main group and compaction summaries are preferred, then recent main groups are added until the first oversized boundary.
- Mandatory overflow fails before provider execution with `Side question exceeds the selected model context limit`.
- Every provider round is rechecked after tool results. A maximum private read result that cannot fit is rejected before a second provider request.
- `LLM.run()` repeats the check after plugin system/parameter transforms and reserves the actual prepared output allowance.
- An immediate `generating` event now precedes lazy context initialization. The finite HTTP exercise consumes the stream through terminal `done`, while the TUI continues to treat status/read/text events as activity.
- All truncation and rejection remain in memory. No side content, tool calls, reads, usage, or compaction is persisted.

## Red Tests Before Fixes

All commands were run from package directories unless a repository-level script required the worktree root.

1. Permission isolation
   - Command: `bun test test/permission/next.test.ts --timeout 30000`
   - Red result: `80 pass, 1 fail`; persisted `ask` resolved to `allow` after an approval remembered in another session.
2. Requested/canonical read authorization
   - Command: `bun test test/session/side-question-reader.test.ts --timeout 30000`
   - Red result: `12 pass, 3 fail`; requested symlink deny, reference worktree-relative deny, and indistinguishable denied existence all failed.
3. Request and context bounds
   - Command: `bun test test/session/side-question.test.ts --timeout 30000`
   - Red result: `17 pass, 4 fail`; oversized schemas were accepted, old turns were not dropped, mandatory overflow reached the provider, and maximum read output reached a continuation.
4. GitLab cached workflow seam
   - Command: `bun test test/session/llm.test.ts -t "fails closed on cached GitLab" --timeout 30000`
   - Red result: `0 pass, 1 fail`; the real workflow model's `doStream()` ran and returned `workflow provider executed` after shared state mutation.
5. OpenAPI bounds
   - Command: `bun test test/server/httpapi-public-openapi.test.ts -t "bounded side-question" --timeout 30000`
   - Red result: `0 pass, 1 fail`; `question.maxLength` was absent.
6. Initial stream activity
   - Command: `bun test test/session/side-question.test.ts -t "continues private read calls" --timeout 30000`
   - Red result: `0 pass, 1 fail`; the first event was `reading`, not an immediate `generating` event.
7. Conservative hard bound
   - Command: `bun test test/session/llm.test.ts -t "conservative UTF-8" --timeout 30000`
   - Red result: `0 pass, 1 fail`; a 466-byte Unicode payload was estimated at only 67 tokens.

## Green Verification

1. Final LLM suite
   - Command: `bun test test/session/llm.test.ts --timeout 30000`
   - Result: `29 pass, 0 fail, 94 expect() calls`.
2. Final side security, permission, and OpenAPI suites
   - Command: `bun test test/session/side-question.test.ts test/session/side-question-reader.test.ts test/permission/next.test.ts test/server/httpapi-public-openapi.test.ts --timeout 30000`
   - Result: `137 pass, 0 fail, 421 expect() calls`.
3. Generated SDK and HTTP integration suite
   - Command: `bun test test/session/side-question.test.ts test/session/side-question-reader.test.ts test/permission/next.test.ts test/server/httpapi-public-openapi.test.ts test/server/httpapi-sdk.test.ts --timeout 30000`
   - Result: `157 pass, 0 fail, 461 expect() calls`.
4. TUI side transcript suite
   - Command: `bun test test/cli/tui/side-question.test.tsx --timeout 30000`
   - Result: `9 pass, 0 fail, 28 expect() calls`.
5. Broader message conversion and compaction suite
   - Command: `bun test test/session/message-v2.test.ts test/session/compaction.test.ts --timeout 30000`
   - Result: `88 pass, 1 pre-existing skip, 0 fail, 207 expect() calls`.
6. Isolated final side HTTP scenario
   - Command: `bun run script/httpapi-exercise.ts --mode effect --include session.side_question --fail-on-skip`
   - Result: `1 pass, 0 fail, 0 skip, 0 missing, 0 extra` after both context-hardening commits.
7. Complete Effect HTTP API exercise
   - Command: `bun run script/httpapi-exercise.ts --mode effect --fail-on-skip`
   - First attempt: shell timeout after 600 seconds while scenarios were still progressing.
   - Diagnostic rerun before the activity fix: `192 pass, 1 fail`; only `session.side_question` missed the one-second first-chunk deadline.
   - Final result after immediate activity and finite-stream exercise correction: `193 pass, 0 fail, 0 skip, 0 missing, 0 extra`.
8. Backend typecheck
   - Command: `bun run typecheck` in `packages/slopcode`
   - Result: pass (`tsgo --noEmit`).
9. SDK regeneration and typecheck
   - Command: `./packages/sdk/js/script/build.ts`
   - Result: pass; generated files formatted, no tracked type-shape delta.
   - Command: `bun run typecheck` in `packages/sdk/js`
   - Result: pass (`tsgo --noEmit`).
10. TUI typecheck
    - Command: `bun run typecheck` in `packages/tui`
    - Result: pass (`tsgo --noEmit`).
11. Documentation build
    - Command: `bun run build` in `packages/web`
    - Result: pass; Astro completed the site build and Pagefind indexing. Existing chunk-size and prerender-header warnings remained non-fatal.
12. Formatting and diff validation
    - Command: `bunx prettier --write` over every touched backend test/source and documentation file.
    - Result: pass.
    - Command: `git diff --check`
    - Result: pass, no whitespace errors.

## Files

- `packages/slopcode/src/permission/index.ts`
- `packages/slopcode/src/session/llm.ts`
- `packages/slopcode/src/session/side-question-reader.ts`
- `packages/slopcode/src/session/side-question.ts`
- `packages/slopcode/test/permission/next.test.ts`
- `packages/slopcode/test/server/httpapi-exercise/index.ts`
- `packages/slopcode/test/server/httpapi-public-openapi.test.ts`
- `packages/slopcode/test/session/llm.test.ts`
- `packages/slopcode/test/session/side-question-reader.test.ts`
- `packages/slopcode/test/session/side-question.test.ts`
- `packages/web/src/content/docs/changelog.mdx`
- `packages/web/src/content/docs/tui.mdx`
- `.superpowers/sdd/final-fixes-report.md`

## Residual Concerns

- No unresolved review blocker remains.
- GitLab workflow models intentionally fail closed for `/btw`; regular GitLab chat models remain available. Supporting workflow models later requires a provider API with immutable request-local executors and a way to disable all hosted capabilities.
- Secure private reads retain the existing intentional Linux/macOS support boundary and fail closed elsewhere.
- Byte-based context accounting is deliberately conservative and may omit older context earlier than a provider-specific tokenizer would require. This is the safety tradeoff needed to enforce a provider-independent upper bound.
