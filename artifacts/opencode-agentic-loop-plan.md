# Slopcode Android agent-orchestration plan

Date: 2026-08-02

This plan is based on read-only analyses of the OpenCode/Slopcode desktop loop. The original analysis is available in `/tmp/slopcode-opencode-agentic-loop-analysis.md`; the follow-up Android/UI gap audit is recorded in `.superpowers/sdd/opencode-ui-gap-analysis.md`.

## Direction

Slopcode Android should be a high-level agent frontend, not an SSH terminal. SSH is an internal, host-key-verified transport used to launch one fixed remote orchestration bridge. The bridge owns the selected backend process and exposes a typed, replayable session protocol to Android.

```text
Android UI
  -> native SSH transport
  -> fixed `slopcode remote-orchestrator --stdio` bridge
  -> selected adapter
       -> Slopcode ACP
       -> OpenCode ACP
       -> Codex app-server
       -> Claude Code stream-json
  -> remote agent/tools/files in the selected workspace
```

Electron is only the desktop shell. The reusable agent loop lives in `packages/slopcode` and `packages/core`: session lifecycle, model turns, tools, approvals, questions, retries, snapshots, diffs, persistence, and event projection.

## Protocol contract

Use bounded, versioned JSON frames over the bridge's stdin/stdout. Do not allocate a PTY for the orchestration surface. The only SSH command is a fixed allowlisted literal; prompts, paths, filenames, model settings, approvals, and answers are framed data, never shell fragments.

Every request includes a session/workspace scope, request ID, idempotency key, and expected revision where relevant. Every event includes a session ID, optional turn ID, monotonic sequence, opaque replay cursor, timestamp, and typed payload.

Core requests:

- `agent.hello`, `workspace.open`, `session.create`, `session.attach`, `session.list`
- `turn.start`, `turn.steer`, `turn.cancel`, `turn.retry`
- `approval.resolve`, `question.answer`, `question.reject`
- `artifact.get`, `change.revert`, `change.unrevert`, `session.close`
- `plan.save.prepare`, `plan.save.commit`

Core events:

- session/turn state and snapshots;
- assistant text and reasoning deltas;
- tool proposed/started/progress/completed/failed;
- command previews, approvals, questions, retries, cancellation, and failure;
- `diff.updated`, `artifact.available`, `plan.available`, `plan.saved`, and `turn.completed`.

Large output, diffs, images, and files are bounded artifacts fetched by opaque ID with size/hash authorization. Unknown or unsupported backend capabilities must be reported as unsupported; do not emulate structured approvals by typing `y`/`n` into a terminal.

## Durable state and reconnect

Replace the current process-memory-only remote-job map with a small SQLite journal in the remote bridge. Persist protocol session/turn IDs, backend session IDs, adapter version/capabilities, idempotency records, event cursor/replay tail, pending interactions, terminal outcomes, artifact metadata, and short-lived plan-save tokens.

On reconnect Android sends its last cursor. The bridge returns an authoritative snapshot followed by events after that cursor. If the replay window is gone, return `snapshot_required`; never silently drop progress. Android applies events with a pure reducer, deduplicates cursors, requests replay on gaps, and keeps approvals/questions as separate indexed state.

Important invariants:

- one active turn per session in v1;
- duplicate requests return the original result;
- interaction replies are revision-checked and idempotent;
- transport disconnect is not evidence that the remote turn failed;
- stop, retry, resume/attach, and terminal completion remain distinct operations.

## Backend adapters

All adapters implement a common contract for probe, create/attach, start turn, approval/question replies, cancel, retry, close, diff, and artifact fetch. Each advertises capabilities such as resume, steering, approvals, questions, reasoning, tool progress, diffs, artifacts, plans, and native persistence.

1. Slopcode: use ACP or direct session services first. Map ACP events and permissions, then add typed question, retry/status, diff, and plan extensions. Preserve native session IDs, snapshots, and plan paths.
2. OpenCode: use `opencode acp` for long-lived sessions; keep `opencode run --format json` only as a capability-limited one-shot fallback. Verify load/resume and plan behavior per supported version.
3. Codex: use `codex app-server` as the fidelity path for threads, turns, approvals, cancellation, and resume. Keep `codex exec --json` only as a limited fallback without unsupported interactive capabilities.
4. Claude Code: use bidirectional `stream-json` with stored session IDs and `--resume`. Pin tested versions, map native control events, and never enable dangerous permission bypass flags.

All adapters use compile-time executable allowlists, validated argv arrays, contained realpath workspaces, filtered environments, bounded output, timeouts, process-group cleanup, and no shell invocation.

## Android experience

1. Authenticate over SSH and choose a normalized remote workspace.
2. Create a session by selecting an adapter/model from the negotiated capability set.
3. Show a conversation plus structured activity cards for tool calls, commands, diffs, screenshots, tests, and artifacts.
4. Pin the oldest pending approval or typed question above the composer with full context and explicit scope.
5. Support cancel, retry, attach/resume, reconnect, and completion as separate actions.
6. Render `plan.available` as Markdown with raw-text and provenance views.
7. Show reviewable diffs and artifacts as first-class content, not terminal text.

### Visual, Android-native onboarding

The normal path should describe the user's intent rather than the transport:

1. **Choose a computer.** Show saved SSH targets as Android-native cards with a
   friendly name, last-used folder, and connection state. The add flow accepts
   one `user@host[:port]` string; port, key format, and other protocol details
   stay behind an Advanced section.
2. **Verify the computer.** Present host-key verification as a shield/security
   card explaining that the app is confirming the computer's identity. Keep the
   fingerprint and key type in expandable technical details, while retaining
   strict rejection of unexpected key changes.
3. **Sign in.** Offer Password and Choose private key as large cards. Use the
   Android document picker for keys, the Keystore-backed credential store for
   saved secrets, and a passphrase bottom sheet. Do not make users paste a
   multi-line private key in the default path.
4. **Choose a workspace.** Use a touch-sized SFTP folder browser with folder
   icons, breadcrumbs, recent-folder cards (maximum three), a prominent Use this
   folder action, and hidden files off by default. Keep raw absolute paths in a
   secondary detail line rather than making them the primary visual language.
5. **Choose an agent.** Render Slopcode, Codex, OpenCode, and Claude Code as
   cards with Ready, Needs setup, or Not installed badges. Show installation and
   login as a checklist with progress, retry, cancel, and safe browser actions;
   reveal fixed npm/login commands only under Technical details.
6. **Start a session.** Show a summary card for computer, folder, and backend,
   then one Start session action. The resulting surface is the structured
   conversation/activity view; the PTY is diagnostic-only and never the primary
   agent experience.

The UI state machine should expose `choosingComputer`, `verifyingComputer`,
`authenticating`, `browsingWorkspace`, `checkingAgent`, `settingUpAgent`,
`ready`, and `error` states. Each state needs one visible next action and a
recoverable error action. Use Material-style top app bars, cards, bottom sheets,
snackbars, 48dp touch targets, TalkBack labels, polite live progress, and an
assertive error region. This preserves SSH's security guarantees while making
the flow feel like a native Android setup wizard rather than a terminal.

## Success criteria

The main product change is conceptual: users should feel like they are choosing
a computer and workspace, not configuring SSH. The Android acceptance flow is
successful only when it satisfies all of the following:

1. **Choose a computer**
   - Saved computers appear as cards, for example `MacBook Pro · void`, with
     status and last-used folder.
   - The primary action is **Add computer**.
   - The normal path accepts one simple `user@host` field.
   - Port, key type, and other SSH fields are hidden under **Advanced**.
2. **Verify the computer**
   - A friendly security card says **Confirm this is your computer** and shows
     the hostname, location, and shield icon.
   - The SSH fingerprint is inside expandable **Technical details**.
   - Changed host keys are always rejected; the app never silently accepts them.
3. **Sign in**
   - Large choices are **Use password** and **Choose private key**.
   - Private keys use Android's document picker instead of a paste-only field.
   - Credentials are stored through Android Keystore-backed storage.
   - Key passphrases are explained in a bottom sheet.
4. **Choose a workspace**
   - SFTP browsing is visual, with folder icons, breadcrumbs, and large touch
     targets.
   - The three most recently used folders appear as cards at the top.
   - Dotfiles are hidden by default; **Show hidden files** is in the overflow
     menu.
   - A clear bottom action says **Use this folder**.
5. **Choose an agent**
   - Slopcode, Codex, OpenCode, and Claude Code appear as cards.
   - Each card exposes a **Ready**, **Needs setup**, or **Not installed** badge.
   - Slopcode is the recommended default.
   - Installation and login use a visual checklist: **Installing → Signing in
     → Verifying**, rather than exposing raw install commands.
6. **Show connection progress visually**
   - The user can see `Connecting → Verifying computer → Loading folders →
     Checking agent → Ready`.
   - Every failure has an inline explanation and one clear action: **Retry**,
     **Choose another folder**, or **Change sign-in method**.
7. **Make the session agentic**
   - The ready screen summarizes computer, folder, and agent, then offers
     **Start session**.
   - The session uses plan cards, progress steps, approvals, questions, diffs,
     screenshots, and test results.
   - The terminal is behind **Diagnostics** and is troubleshooting-only.

### Android-native acceptance gates

- Use Material 3 cards, top app bars, bottom sheets, snackbars, and progress
  indicators.
- Use the Android document picker for private keys and Android browser intents
  for login links.
- Provide TalkBack labels and live progress announcements.
- Keep interactive targets at least 48dp.
- Deep-link directly to a session or pending approval.
- Provide native notifications for setup, reconnect, approval, completion, and
  failure.

The highest-value first pass is accepted only when it replaces the raw form with
a stepper and cards, hides advanced SSH fields, adds the Android key picker,
redesigns folder selection, and turns CLI setup into a visual checklist.

## Plan persistence

Normalize every plan to an ID, session/turn, title, Markdown, SHA-256, source, backend path, and `alreadyPersisted` flag. Prefer native plan events or designated plan-file writes; mark plans inferred from assistant prose as derived.

Saving is a two-phase bridge operation:

1. Android asks `plan.save.prepare` with a basename and approved directory policy.
2. The bridge validates workspace containment, realpaths, symlinks, filename rules, collision state, byte limit, and content hash; it returns the exact target and a short-lived single-use token without writing.
3. Android confirms the displayed target and overwrite choice.
4. Android sends `plan.save.commit` with the token, expected plan hash, and expected existing hash when overwriting.
5. The bridge revalidates, writes atomically inside `<workspace>/.slopcode/plans`, verifies SHA-256, and emits `plan.saved`.

Never write plans through SFTP from Android or by prompting the model to run a shell redirection. If a backend already persisted its designated plan, show the existing plan instead of duplicating it.

## Delivery phases

- **P0 contract:** strict schemas, capability matrix, event/state machine, limits, idempotency, cursor replay, and stable errors.
- **P1 vertical slice:** fixed SSH bridge, durable supervisor, Slopcode adapter, Android conversation/reducer, approvals/questions, reconnect, review, and plan save.
- **P2 OpenCode:** ACP adapter, resume, permissions/questions, plan metadata, and version fixtures.
- **P3 Codex:** app-server adapter, threads/turns, native approvals, resume, diffs, and limited JSON fallback.
- **P4 Claude:** pinned stream-json adapter, resume, native controls, plan mode, and capability downgrade.
- **P5 hardening:** artifacts, snapshot/diff provenance, orphan recovery, quotas, migration, and privacy-safe telemetry.

## Acceptance tests

- protocol encode/decode, bounds, secret redaction, path/filename containment, symlink swaps, cursor gaps, stale revisions, and idempotency;
- adapter golden streams for text, reasoning, tools, approvals, questions, retries, plans, diffs, cancellation, and unknown events;
- exact executable/argv/cwd/environment assertions with no shell invocation;
- bridge, adapter, Android, and network process death at every lifecycle point with replay and no duplicate turns;
- real-host end-to-end sessions for all four backends, including plan display/save, diff/review, cancel, retry, resume, reconnect, and completion;
- Android lifecycle/background, notification/deep-link, accessibility, offline/reconnect, and pending-interaction tests.

The current direct SSH PTY implementation is useful as a transport foundation, but the high-level Android surface should evolve toward this structured bridge and hide terminal controls once the orchestrator vertical slice is available.

## Implementation tasks

### Task 1: Add the structured agent-orchestration protocol

Create a strict Effect Schema module in `packages/protocol` for the v1 Android/remote-bridge contract. It must define bounded agent IDs (`slopcode`, `opencode`, `codex`, `claude`), capabilities, workspace/session/turn requests, approval and question interactions, plan save prepare/commit messages, artifact metadata, ordered replayable events, and stable error envelopes. Use exact decoding with excess-property rejection, bounded text/arrays/frames, normalized absolute POSIX paths, and no secret-shaped metadata. Add package tests for valid frames, malformed/oversized frames, path traversal, stale interaction revisions, cursor ordering, and idempotency fields. Export the module from `packages/protocol/src/index.ts`.

### Task 2: Build a durable remote orchestration journal

Add a SQLite-backed journal behind the existing remote-agent job service. Persist session/turn/backend mappings, idempotency records, cursor/event tails, pending interactions, terminal outcomes, artifact metadata, and plan-save tokens. Support atomic duplicate/conflict handling, cursor replay, snapshot-required responses, expiry/quotas, and restart recovery. Add Slopcode package tests for process restart, duplicate requests, cursor gaps, interaction races, and bounded retention.

### Task 3: Add the fixed stdio bridge and Slopcode/OpenCode adapter

Add a fixed allowlisted remote-orchestrator stdio entrypoint that does not allocate a PTY or invoke a shell. Implement bounded framed JSON I/O, workspace containment, process cleanup, and the common adapter lifecycle. Start with Slopcode/OpenCode ACP, preserving native session IDs and mapping text, reasoning, tool, approval, question, retry, diff, artifact, and plan events. Add real adapter fixtures and capability downgrade behavior for unsupported protocol features.

### Task 4: Add the structured Android orchestrator frontend

Replace the high-level Android PTY session surface with a durable session reducer and structured conversation/activity UI. Keep native SSH as an internal transport, add bridge attach/reconnect cursors, render tool/command previews, approvals, questions, diffs, artifacts, plan Markdown, retry/stop/resume states, and actionable notifications/deep links. Keep terminal controls out of the orchestrator UI. Add lifecycle, process-death, offline/reconnect, duplicate-event, approval/question, and accessibility tests.

### Task 5: Add Codex and Claude adapters plus end-to-end certification

Implement Codex app-server and Claude bidirectional stream-json adapters with pinned capability/version probes, native cancellation/resume, structured approval/question mapping where supported, and safe capability downgrades otherwise. Add plan save two-phase verification, real-host tests for all four backends, Android emulator tests, and final whole-branch review.

### Task 6: Add constrained remote backend setup

When a selected CLI is missing, Android must present a backend-specific, fixed install recipe and require an explicit confirmation before executing it over the verified SSH connection. Use the official package/installer for each allowlisted backend, never an arbitrary command entered by the user, and stream bounded stdout/stderr plus actionable exit errors into a setup timeline. After installation, offer the backend's fixed login flow as an interactive SSH operation, expose browser/device-code URLs as safe Android actions when present, and rerun the version/auth preflight before persisting the workspace. Persist no backend credentials in the WebView; keep SSH credentials in the existing Android Keystore-backed store. Add tests for missing CLI, install success/failure, login output, retry, cancellation, and re-preflight.

### Task 7: Emulator regression and credential-safe release evidence

Use the attached Android emulator as the primary release-candidate target. Keep a hermetic SSH fixture and a deterministic remote-job fixture for PR tests, then run protected live Tailscale SSH certification for the release candidate. Cover onboarding, host-key mismatch, SFTP navigation and hidden-file defaults, all four allowlisted agents, one-shot and interactive transport controls, process death, offline/reconnect, cursor resume, duplicate events, approvals/questions, notifications, and deep links. Pair UI screenshots with accessibility-tree assertions and retain only sanitized evidence. SSH private keys and backend credentials may be stored only in Android Keystore-backed local storage or short-lived local test secret storage; never commit, upload, log, screenshot, or publish them. Installation/login tests must use disposable hosts and always clean up.
