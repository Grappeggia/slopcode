# Zero-State Prompt RCA

## Reproduction

1. Open the web app's `/new-session` draft composer while the directory agent/provider queries are still loading.
2. Enter text in the contenteditable and press Enter once.
3. Before this fix, submission read an unavailable model or agent and returned without sending. If loading had completed, session creation immediately seeded and promoted the draft, navigated, reset worktree state, cleared comments, and cleared the editor before durable prompt admission completed.
4. Return HTTP 400 from `POST /session/:id/prompt_async` through the generated SDK's default non-throwing `{ error, response }` result. Before this fix, `sendFollowupDraft` ignored the result and treated it as success, so the cleared and unmounted draft could not be recovered.

## Root Cause

- `sendFollowupDraft` assumed `promptAsync` rejected on HTTP errors, but generated clients can resolve with `{ error, response }`. The root and selected-worktree client configurations therefore had different observable error behavior.
- New-session side effects occurred after session creation instead of after durable prompt admission. Recovery attempted to write the old prompt back into a draft provider that navigation had already unmounted.
- Enter handling had no new-draft admission lock or readiness wait. A keypress during query loading sampled `local.model.current()` and `local.agent.current()` once, then silently returned.
- Retry state did not retain a provisional session or delivery identity, so it could not distinguish an authoritative rejection, which is safe to retry with a fresh ID, from ambiguous transport/5xx delivery, which must retain the ID.
- The first fix kept provisional state and readiness promises inside `PromptInput`. Tab switches destroyed that state, detached readiness work could outlive the component, and accepted requests could still promote from an inactive owner.
- Draft promotion removed persisted draft keys without transferring edits made after submission. Prompt context, cursor, comments, attachments, and shell mode therefore disappeared when admission completed after the draft changed.
- Stable-ID retries rebuilt part IDs and optimistic state was scoped to a disposable directory context, so an ambiguous replay was not an exact request and its optimistic row could disappear across remounts.
- Held admission objects were still usable after a draft/server removal deleted their owner entry, allowing a late response to race transition navigation. Failed worktree state was also treated as ready, and direct-route owners could survive abandonment.
- Retained normal deliveries could pass through command lookup again when the command catalog changed, violating exact ambiguous replay.
- Owner-map deletion originally dropped only client state: settled 400/503 sessions and sessions returned after close-during-create had no cleanup path. Optimistic destination writes also accidentally targeted the source directory because the target helper shadowed its `directory` parameter.

## Fix

- Queue one normal submission in component-owned Solid state while agent/provider queries load. Read the latest draft when readiness arrives, collapse repeated Enter/form events, and discard the queue when the component unmounts. Shell and known custom commands bypass this queue.
- Store provisional sessions, exact prepared requests, message/part IDs, and delivery state in `TabsProvider`, keyed by server and draft ID (or a directory-scoped legacy owner). The store survives route remounts, never stores clients, and is cleared by promotion, draft removal, and server removal.
- Recreate the selected-directory SDK client for each attempt. Attach auto-accept to the provisional session, but defer session seeding, local/tab promotion, navigation, worktree reset, comment clearing, and editor reset until `promptAsync` confirms admission.
- Force `promptAsync` to return non-throwing results for every client and classify responses like the TUI: non-timeout 4xx is authoritative, while 408/425/429/499, 5xx, and thrown transport failures are ambiguous.
- Classify worktree preparation failures and pre-request cancellation as `not-sent`. Authoritative and not-sent outcomes clear the retained request identity; ambiguous outcomes retain the exact request, message ID, part IDs, model, agent, and context for replay.
- Fence every post-await UI action by the active draft owner. Completion while away only updates retained admission state; returning to the draft reactively and idempotently finalizes it.
- Require owner-map object identity and live draft-tab membership for every continuation and finalization. Draft/server removal invalidates owners before transitions; late completions only best-effort delete their provisional resources.
- Treat pending-to-failed and already-failed worktrees as `not-sent`, clear failed worktree ownership, and delete their provisional sessions. Authoritative/not-sent retries that select another worktree discard the old provisional before creating a scoped replacement.
- Mark direct-route state abandoned on cleanup. Idle state is deleted immediately; creating or sending state is deleted after its in-flight operation settles, including ambiguous responses, and can never promote or be reused.
- Prepared normal deliveries bypass command routing completely, so catalog changes cannot turn an ambiguous replay into a command request.
- Before promotion, compare prompt/context/mode/worktree with the submitted snapshot. Unchanged drafts are cleared; changed drafts atomically copy the current prompt, cursor, full context, comments, attachments, and mode into the destination session scope before draft persistence is removed. Changed-comment callbacks are not invoked. Both draft and direct routes are supported.
- Remove an existing optimistic message before stable-ID re-add, preserve optimistic state across directory context remounts, and reuse prepared parts so retries cannot create duplicate rows or new part IDs.
- Keep optimistic retention in the ServerSync-owned registry and clear it with that provider lifetime rather than module-global process state.
- Register a provider-lifetime resource disposer on each provisional owner. Tabs invokes it synchronously before invalidation, while successful promotion uses a non-cleaning release. Cleanup removes registry and destination child-store optimistic state before one best-effort session delete, remains idempotent after late responses, and still runs when delete fails. A late `session.create` result is assigned before owner validation so invalid owners can delete it exactly once.
- Resolve optimistic add/remove stores using distinct source/destination directory variables so selected-worktree prompts never pollute the main directory.
- Keep existing-session queue/steer behavior asynchronous and unchanged. Shell and custom-command new-session behavior remains immediate.

## Tests

- `src/components/prompt-input/submit.test.ts` verifies non-throwing SDK classification, `not-sent` worktree failures, one provisional session across remounts, monotonic fresh IDs after 400, exact stable request replay after 503, and full changed-state transfer for draft and direct routes without comment-clearing callbacks.
- Focused submission tests also cover close-during-admission invalidation, pending-to-failed worktree retry, authoritative worktree retargeting, provisional deletion, and command-catalog changes during ambiguous replay.
- The close matrix covers settled 400/503, close during `session.create`, accepted and ambiguous in-flight responses, delete failure, exact-once deletion, and optimistic cleanup.
- `src/context/tabs-submission.test.ts` verifies explicit draft/server cleanup of retained admission owners.
- `src/context/directory-sync.test.ts` verifies selected-worktree optimistic writes target only the destination child store.
- `src/context/server-sync.test.ts` verifies provider-owned optimistic retention cleanup.
- `e2e/regression/new-session-prompt-admission.spec.ts` uses the actual contenteditable Enter/form path. It covers delayed readiness and repeated Enter, queue cancellation on navigation, 400/503 tab remounts, exact ID behavior, changed text/mode while admission is held, completion while away, optimistic-row preservation, one server session, draft/direct route promotion, settled 400/503 close cleanup, close during accepted admission and session creation, and ambiguous direct-route abandonment without stale reuse.
- Focused app unit tests, Playwright regression, app typecheck, formatter, lint, and diff checks are run before completion.
