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

- The complete `packages/slopcode` typecheck currently fails in the pre-existing Task 2 remote-job journal and HTTP route changes. It reports no errors from the Task 3 bridge, ACP adapter, CLI, or tests.
- The ACP bridge deliberately advertises only negotiated baseline capabilities. URL elicitation and ACP update types without a lossless v1 mapping are surfaced as explicit unsupported output rather than simulated through a terminal.
- Codex and Claude adapters, durable bridge replay, plan-save commits, and Android structured UI remain Tasks 4 and 5.
