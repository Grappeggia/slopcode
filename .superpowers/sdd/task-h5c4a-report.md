# H5C4A Report

## Architecture

- `packages/core/src/mcp/client.ts` owns the MCP SDK boundary. It creates local stdio, Streamable HTTP, and SSE fallback clients; resolves local cwd from the Location; forwards environment and headers; applies request/connect timeouts; and makes client closure idempotent.
- `packages/core/src/mcp.ts` owns Location-scoped effective MCP config, status/events, concurrent connection and discovery, deterministic registration, refresh, execution adaptation, and lifecycle.
- Each configured server receives one lifetime `Tools.Service` slot anchor in config order. Discovered tools replace an active child scope in that slot atomically, so disconnect hides tools before transport close, reconnect keeps precedence, and captured materializations become stale through the existing `ToolRegistry` identity fence.
- MCP tools are canonical `Tool.dynamic` values. Input uses the advertised JSON Schema through AJV; execution uses existing `PermissionV2`, `PluginV2` before/after hooks, Effect interruption, `ToolRegistry` settlement, CodeMode projection, and `ToolOutputStore` bounding.
- Initial MCP connection runs in a scoped background fiber. Location and PluginBoot construction do not wait for unavailable remote servers; the internal `ready` method exists for deterministic Core tests.
- No V1 MCP service is imported. OAuth, public APIs, prompts/resources, and HTTP/TUI controls remain out of scope.

## Lifecycle

- Configured servers connect concurrently; stable empty slots and sequential activation preserve config order regardless of completion order.
- Disabled and failed servers retain typed status without failing Location startup or suppressing healthy servers.
- Failed connect, refresh replacement, reconnect, explicit disconnect, spontaneous close, and Location shutdown all close owned registrations and clients through idempotent closure.
- Stdio cleanup captures descendants before SDK close and terminates them after direct process cleanup.
- Refresh discovers and validates a complete replacement before registration. Failed refresh preserves the prior active tool set and publishes a redacted discovery failure.
- Cross-server sanitized collisions are detected from the complete initial discovery set before any colliding server registers tools. Per-server collisions and invalid/overlong canonical names fail adaptation.

## TDD Evidence

### RED

- Added `packages/core/test/mcp.test.ts` before implementation.
- `bun test test/mcp.test.ts` failed with `Cannot find module '@slopcode-ai/core/mcp'`, establishing the missing runtime boundary.
- The first GREEN attempt exposed the absent Core SDK dependency link and a server-lock re-entry during discovery; both were fixed before proceeding.
- Expanded tests exposed a nondeterministic slot-order risk during self-review and a full-suite Location test contaminated by the developer's global MCP config. Stable slot anchors and dependency-isolated Location tests fixed both.

### GREEN

- Focused MCP/Location: 16 passed, 0 failed, including real stdio, Streamable HTTP, SSE fallback, timeout cleanup, effective config precedence, disabled/failure isolation, pagination fallback/repeated cursor, collisions, refresh/staleness, hooks, permissions, interruption, result normalization, CodeMode, real bounding, disconnect/reconnect, and Location shutdown.
- Full Core: 1336 passed, 0 failed, 3969 assertions with `bun test --timeout 10000`.
- Full CodeMode: 254 passed, 0 failed, 744 assertions.
- Core and server typechecks passed.
- Frozen install passed with no changes.

## Files

- `bun.lock`
- `packages/core/package.json`
- `packages/core/src/location-layer.ts`
- `packages/core/src/mcp.ts`
- `packages/core/src/mcp/client.ts`
- `packages/core/test/fixture/mcp-server.ts`
- `packages/core/test/location-layer.test.ts`
- `packages/core/test/mcp-client.test.ts`
- `packages/core/test/mcp.test.ts`
- `.superpowers/sdd/task-h5c4a-report.md`

## Commands

- `bun test test/mcp.test.ts test/mcp-client.test.ts test/location-layer.test.ts`: 16 pass, 0 fail.
- `bun test --timeout 10000` from `packages/core`: 1336 pass, 0 fail.
- `bun test` from `packages/codemode`: 254 pass, 0 fail.
- `bun run typecheck` from `packages/core`: pass.
- `bun run typecheck` from `packages/server`: pass.
- `bun install --frozen-lockfile`: pass, no changes.
- `git diff --check`: pass.
- `bunx prettier --check ...`: initially reported four new files; formatted them and re-ran focused tests/typecheck successfully.

The default 5-second full Core run had one unrelated public API test time out at 5.08 seconds. Its isolated rerun passed in 5.46 seconds, and the complete suite passed with the explicit 10-second test timeout.

## Commits

- `29f370ab81 feat(core): add location MCP runtime`
- Report commit: this file's commit.

## Self-Review

- Verified Application tools precede Location plugin tools, which precede MCP slots.
- Verified secrets are removed from status, events, and logs by replacing configured header/environment values before publication.
- Verified SDK promise rejection maps to typed `Tool.Failure`, while synchronous adapter defects remain defects.
- Verified `callTool` receives Effect's AbortSignal and `resetTimeoutOnProgress: true`.
- Verified structured-only results receive stable sorted JSON text and all file-producing content validates MIME/base64 before reaching canonical output.
- Verified old materializations fail stale after refresh and all output still traverses registry bounding/full-output storage.
- Verified no V1 runtime imports, OAuth implementation, public route, SDK route, or TUI changes were introduced.

## Concerns

- No known H5C4A correctness concerns. OAuth and public control surfaces are intentionally deferred to H5C4B/H8.
