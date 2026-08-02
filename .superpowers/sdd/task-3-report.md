# Task 3 report: fixed stdio bridge and ACP adapters

## Changed files

- `packages/protocol/src/agent-orchestration.ts` and its test: added success acknowledgements plus typed reasoning, tool, retry, and plan-available events. Native backend IDs can be retained in bounded non-secret metadata.
- `packages/slopcode/src/cli/cmd/remote-orchestrator.ts` and `src/index.ts`: registered the fixed `slopcode remote-orchestrator --stdio` entrypoint.
- `packages/slopcode/src/remote-orchestrator/{bridge,acp,workspace}.ts`: added bounded JSON-line framing with strict frame validation, stdout-only protocol records, stderr diagnostics, realpath workspace containment, cleanup, an allowlisted no-shell ACP launcher, and shared ACP session lifecycle for Slopcode and OpenCode.
- `packages/slopcode/test/remote-orchestrator.test.ts` and `test/fixture/remote-orchestrator-acp-agent.ts`: added a real spawned ACP fixture covering initialization, session creation, text, reasoning, tool, diff artifact, approval, question, plan, retry, native-ID mapping, cleanup, framing, and stdout isolation.
- `packages/slopcode/package.json`: declared the protocol workspace dependency.

## Validation

- `packages/protocol`: `bun test test/agent-orchestration.test.ts` — 6 passed; `bun run typecheck` — passed.
- `packages/slopcode`: `bun test test/remote-orchestrator.test.ts --timeout 30000` — 4 passed.
- `packages/slopcode`: Prettier check for bridge, CLI, tests, and fixture — passed.
- CLI smoke test: piped a valid `workspace.open` frame to `slopcode remote-orchestrator --stdio`; received a validated response on stdout.
- `git diff --check` — passed.

## Limitations

- The ACP bridge deliberately advertises only negotiated baseline capabilities. URL elicitation and ACP update types without a lossless v1 mapping are surfaced as explicit unsupported output rather than simulated through a terminal.
- Codex and Claude adapters, durable bridge replay, plan-save commits, and Android structured UI remain Tasks 4 and 5.

## Correction commit

- Pending interactions now record owning session, kind, revision, and native ID; stale, wrong-kind, wrong-session, and replayed replies are rejected before the adapter is invoked.
- ACP artifacts are resolved through workspace `realpath` containment before they can become protocol artifacts. ACP-originated strings are control-stripped and UTF-8 byte-bounded before bridge projection.
- ACP subprocess teardown is bounded, handles an already-exited child, escalates from `SIGTERM` to `SIGKILL`, and cleans up initialization/session-creation failures.
- Focused bridge coverage now exercises stale approval, wrong-kind question, and replay replies.

## Final correction

- Public interaction IDs now include the bridge session ID before hashing, so identical native interaction IDs from separate ACP sessions remain independently replyable.
- ACP approval locations are accepted only when they are bounded, control-free absolute paths that `realpath` inside the active workspace. Invalid, traversal, and symlink-escape locations are omitted while the approval remains pending and actionable.
- Validation: `packages/slopcode` remote-orchestrator tests (10 passed), `packages/protocol` orchestration tests (6 passed), both package typechecks, and `git diff --check` passed.

## Task 3b correction

- Workspace approval and artifact paths are now checked before and after `realpath` using the same absolute, normalized, control-free, UTF-8 byte, and containment rules. Invalid canonical symlink results are omitted without dropping the pending approval.
- Each bridge session permits one active turn. A concurrent turn receives a stable `bad_request` conflict, and event callbacks capture the originating turn ID before asynchronous projection.
- Stdio requests use a bounded 256-record in-memory idempotency ledger. Equivalent request/idempotency pairs replay the original response; conflicting reuse returns `idempotency_conflict` without creating another ACP session or turn. Fingerprints are hashes, not stored prompts.
- Tool, plan, and artifact IDs and generated plan paths are scoped by bridge session and native ID. A per-session projection queue preserves ACP event order while canonical paths resolve asynchronously.
- Regression coverage includes invalid canonical symlinks and oversized/traversal paths, overlapping turns and delayed output, duplicate/conflicting session and turn requests, cross-session public-ID collisions, and asynchronous event ordering.

The bridge idempotency ledger remains intentionally in memory; durable restart recovery is still a follow-up for the journal integration and is not claimed by this correction.
