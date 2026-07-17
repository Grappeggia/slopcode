# `/new` First-Prompt RCA

## Reproduction

The mirror-only `prompt-submit-race.test.ts` was replaced by `packages/tui/test/new-prompt-integration.test.tsx`. The new tests boot the canonical `run()` application tree, including `App`, `Home`, `Prompt`, `SessionTabsProvider`, plugin slots, and the generated v2 SDK client. They drive the focused OpenTUI textarea and dispatch the real `session.new` command. The fetch control records method, pathname, query, and JSON body; response controls and `session.created` envelopes are also retained.

### A: workspace-only model after `/new`

1. Boot an existing `work_1` session.
2. Return only `workspace/workspace-model` when bootstrap requests include `workspace=work_1`.
3. Dispatch `session.new` and submit `workspace first prompt`.
4. Accept the prompt only when both create and prompt target the workspace directory and `work_1`, with the workspace-only model in each generated SDK body.

Before the fix, the first bad boundary was generated SDK input at `session.create`:

```text
POST /session
query: { directory: <tmp>/workspace }
body:  { agent: "build", model: { providerID: "workspace", id: "workspace-model" } }
```

The model came from workspace bootstrap, but `workspace=work_1` was absent because Home's workspace picker had no explicit selection. The prompt request also omitted workspace routing, so the control returned HTTP 400 (`workspace provider unavailable`). The failing test stopped first on the create query mismatch.

### B: `/new` during delayed Home create

1. Submit `older prompt` from Home and hold its real `POST /session` response.
2. Dispatch `session.new` while that request is pending.
3. Submit `newer prompt` before releasing the first create.
4. Release the old response after the newer draft has navigated.

Before the fix, the Home component's single `submitting` boolean still belonged to the old request, so the newer draft could not issue its own create. When the old request resumed, it read the live/replaced textarea and reached a destroyed OpenTUI `EditBuffer`. The original code also had an unfenced 50 ms navigation timer, allowing an older completion to replace the newer route.

### Prompt rejection control

The create control returns a valid session and the first prompt control returns HTTP 400. Before the fix, Prompt started the request without awaiting acceptance, immediately cleared the textarea, promoted the draft, and navigated to the session. The real test observed `session/ses_rejected` instead of Home and lost the exact text.

## Root Cause

The failure was a composition of three client-side ownership defects:

1. Home create routing considered only an explicit workspace-picker selection. It ignored `project.workspace.current()`, even though the selected provider/model came from that workspace.
2. Submission state and payload were live component state. Text, extmarks, mode, model, editor context, and location were read after asynchronous directory/session creation, while one component-local boolean serialized unrelated draft generations.
3. Prompt HTTP completion was detached. Promotion, history mutation, clear, callback, and delayed navigation happened before acceptance and without checking whether the originating draft still owned Home.

The controlled `session.created` event was delivered in every create flow. Its absence from Sync was not the first bad boundary and adding a handler did not address routing, payload ownership, or rejection handling, so no speculative sync change was made.

## Fix

- `SessionTabsProvider` assigns each new draft a UUID owner and fences `promoteDraft` by that owner. `App` keys Home by the draft owner, while prompt stashes distinguish Home drafts and per-session drafts.
- Prompt snapshots text, expanded extmarks, non-text parts, mode, agent, model, variant, editor context, workspace choice, and session location before its first await.
- A Home draft without an explicit workspace choice inherits the active project workspace. Create, prompt, shell, and command requests carry one explicit directory/workspace route and the snapshotted model.
- Prompt submission is awaited with `throwOnError`. HTTP rejection leaves the current draft and exact text in place and does not promote or navigate as success.
- Clear, editor mutation, move cleanup, promotion, and navigation run only for the still-current owner. The unfenced 50 ms timer was removed.
- The mirror helper test was removed in favor of canonical lifecycle integration coverage.

## Tests

- `bun test test/new-prompt-integration.test.tsx test/session-tabs-integration.test.tsx test/session-tabs-state.test.ts --timeout 30000`: 16 pass.
- `bun test --timeout 30000 --only-failures` in `packages/tui`: 272 pass, 1 skip.
- `bun run typecheck` in `packages/tui`: pass.
- `bun test test/session/prompt.test.ts test/server/httpapi-sdk.test.ts test/server/httpapi-session.test.ts test/server/httpapi-event.test.ts test/server/httpapi-promptasync-context.test.ts --timeout 30000 --only-failures` in `packages/slopcode`: 127 pass, 1 skip.
- `bun run typecheck` in `packages/slopcode`: pass.
- `bun run typecheck` in `packages/sdk/js`: pass.
- `bunx prettier --check packages/tui/src/app.tsx packages/tui/src/component/prompt/index.tsx packages/tui/src/context/session-tabs.tsx packages/tui/test/new-prompt-integration.test.tsx`: pass.
- `bunx oxlint packages/tui/test/new-prompt-integration.test.tsx`: 0 warnings, 0 errors.
- `bun run lint`: 0 errors, 4,922 pre-existing repository warnings.
- `git diff --check`: pass.

## Commit

`fe03ceed81` - `fix(tui): preserve new prompt ownership`

## Concerns

- The full `packages/slopcode` suite was attempted twice. It reported no failure but exceeded external command limits at 5 and 15 minutes; the complete relevant session/HTTP SDK subset passed.
- Superseded by the follow-up below: create-success/admission-failure now retains and reuses the provisional session for the same draft owner.
- Repository lint is warning-heavy at baseline, but the new integration test is independently warning-free.

## Review Follow-Up

The first fix preserved workspace routing and fenced stale Home owners, but review found five incomplete lifecycle boundaries around admission and retry:

1. Normal prompts awaited the synchronous `/message` assistant loop, keeping the owner locked and preventing prompt steering/queueing.
2. The owner tag guarded one module-level stash slot, so unmounting another owner could overwrite an unrelated Home or session draft.
3. A thrown `session.create` bypassed cleanup, while create-success/prompt-failure retries created another session and could recompute a different destination.
4. Detached shell and command promises discarded HTTP failures after optimistically clearing the input.
5. The integration control returned a message body from `/message`, not the real `prompt_async` 204 admission contract.

### Follow-Up Fix

- Normal TUI prompts use `session.promptAsync(..., { throwOnError: true })`. Only immediate HTTP acceptance permits history, clear, promotion, and navigation. A changed composer is never cleared, and the submission owner is released without waiting for the assistant loop.
- `SessionTabsProvider` owns a 32-entry map keyed by the Home draft UUID or scoped session ID. Each Prompt consumes only its own saved value; successful clear/promotion, tab close, and replacement Home owners remove their entries.
- The same owner map retains prepared directory/workspace/move state and an optional provisional session. Create transport and response errors release move progress without clearing the selected destination. Admission retries reuse both the prepared destination and provisional session; promotion, close, and `/new` clear them.
- Shell and command calls remain detached so they cannot hold the submit owner across an assistant loop. Both use `throwOnError`, surface failures, and restore the exact snapshotted prompt to its owner or the bounded persistent stash when that owner is stale/closed.
- Payload text, cursor, extmarks, non-text parts, agent/model/variant, editor context, directory, and workspace are snapshotted before awaits. Existing workspace and stale-owner routing controls continue to pass.

### Follow-Up Tests

- `bun test test/new-prompt-integration.test.tsx test/session-tabs-integration.test.tsx test/session-tabs-state.test.ts --timeout 30000 --only-failures`: 22 pass.
- `bun test --timeout 30000 --only-failures` in `packages/tui`: 278 pass, 1 skip.
- Relevant session/HTTP/generated-SDK tests in `packages/slopcode`: 127 pass, 1 skip.
- `bun run typecheck` in `packages/tui`, `packages/slopcode`, and `packages/sdk/js`: pass.
- Changed-file Prettier check and `git diff --check`: pass.
- Changed-file oxlint: 0 errors; repository lint: 0 errors and 4,922 pre-existing warnings.

Coverage now includes real 204 admission with valid `wrk_...` routing, rapid existing-session edits and second submission, independent Home/session A/session B drafts, provisional reuse after admission rejection, thrown create after project-copy preparation, detached shell/command failures, and stable expanded extmark/file payloads across delayed admission.

### Follow-Up Commit

`a21fd3ed0d` - `fix(tui): complete new prompt admission lifecycle`

## Durable Admission Follow-Up

Review of the async boundary found that `/prompt_async` still returned before V1 prompt persistence completed, while TUI retries generated a new message ID and owner storage could silently evict live drafts. Recovery also lost shell mode, and editor completion marked whichever selection happened to be current after admission rather than the selection included in the request.

### Server Fix

- `SessionPrompt.admit` now owns only durable, idempotent V1 user-message admission and reports whether the caller must start execution. `SessionPrompt.prompt` retains the existing synchronous contract by admitting and then running `loop`.
- `SessionControl.admit` routes V1 through the new admission boundary and V2 through the existing durable control prompt. The synchronous `SessionControl.prompt` path is unchanged semantically.
- `POST /prompt_async` awaits admission before returning 204. Fresh V1 admissions fork the assistant loop into the server scope; post-admission failures are logged and published as `session.error`. V2 remains asynchronously scheduled by its durable control prompt.
- Exact duplicate message IDs return the original durable admission, conflicting payloads fail before 204, and preparation/persistence failures remain HTTP errors.

### TUI Fix

- Each owner retains a stable message ID keyed by the complete snapshotted submission. Prompt, shell, and command retries reuse it after ambiguous transport or provisional-session failures and clear it only after acceptance.
- Prompt recovery stores and restores `normal` or `shell` mode. Shell and command retries therefore preserve both exact payload and ID.
- Editor context is cloned before the request, and `markSelectionSent` succeeds only when the current selection still matches that snapshot.
- Owner state is valid only while its draft/session tab is live. Draft promotion migrates prompt and submission state to the created session, child-to-root replacement migrates canonical owner state, and close/new-draft cleanup removes it.
- The lossy 32-owner eviction cap was removed; live tab lifecycle is now the cleanup boundary.

### Follow-Up Tests

- Focused server/control: 48 pass. Covers split V1 admission, unchanged synchronous prompt execution, V1/V2 durable 204 behavior, pre-admission failures, exact duplicate/conflicting IDs, blocked V2 execution, and post-admission `session.error`.
- Focused TUI ownership/retry: 26 pass. Covers lost-response retry with one provisional session/message ID, promotion and replacement migration, stale Home rejection, close cleanup, retention beyond 32 owners, editor selection changes, and exact shell/command mode and ID recovery.
- Full TUI: 282 pass, 1 skip.
- Relevant SlopCode session/HTTP: 151 pass, 1 skip.
- Relevant core durable-session: 62 pass.
- Typechecks: `packages/tui`, `packages/slopcode`, and `packages/sdk/js` pass.

### Follow-Up Concerns

- Full TUI tests emit existing KV-state warnings for `/tmp/slopcode/state/kv.json`; the suite still completes with zero failures.
- Changed-file oxlint reports 42 existing warnings and zero errors. Repository lint reports 4,921 existing warnings and zero errors.

## Final Review Closure

The final admission review found one server interruption window and three client recovery assumptions that were still unsafe: V1 could persist a prompt before the HTTP handler launched its loop, terminal HTTP rejections retained immutable message IDs, shell and command retries treated IDs as idempotency keys, and owner/stash recovery could lose mode or a competing draft.

### Admission And Events

- The V1 `prompt_async` admit-and-fork boundary is uninterruptible. Exact V1 replay requests resume through `ensureRunning` unless `noReply` is set, so replay repairs a missing loop, joins an active loop, and exits without provider work after a completed response.
- The detached handler no longer republishes generic `session.error` events after a loop path already emitted its specific failure. The regression path records exactly one public event.
- Real HTTP coverage interrupts at `internal.v1.prompt.completed`, verifies provider launch, and verifies that a conflicting terminal ID is rejected while a rotated ID is admitted.

### Client Recovery

- Normal prompts retain their ID only when no HTTP response exists. A definitive rejection clears the failed ID but retains the exact text, provisional session, destination, routing fields, and attachments for a fresh-ID retry.
- Shell and command responses are classified by response presence. Definitive rejection restores the exact mode and text with a fresh ID; ambiguous delivery stays in prompt history, leaves the composer clear, and warns the user to inspect the session before manually running anything again.
- Persistent stash entries now include prompt mode. Existing JSONL entries migrate to `normal`, while fallback recovery restores `shell` mode.
- Owner migration keeps the source draft active and queues any competing target draft. Queue draining preserves mode, cursor, and attachment parts instead of overwriting either draft.

### Final Verification

- Focused V1 prompt tests: 79 pass, 1 skip. Focused HTTP handler tests: 29 pass. Focused TUI recovery/ownership/stash tests: 20 pass.
- Full TUI: 285 pass, 1 skip.
- Relevant SlopCode session and HTTP tests: 128 pass, 1 skip.
- Relevant core durable-session tests: 93 pass.
- Typechecks pass for `packages/slopcode`, `packages/tui`, and `packages/core`; Prettier and `git diff --check` pass.
- Changed-file oxlint reports 53 existing warnings and zero errors. Repository lint reports 4,921 existing warnings and zero errors.

### Remaining Operational Note

- Shell and command endpoints still do not provide server-side idempotency. After ambiguous transport failure the TUI intentionally does not create an automatic retry path; the user must inspect session state before deciding whether to run the operation again.
