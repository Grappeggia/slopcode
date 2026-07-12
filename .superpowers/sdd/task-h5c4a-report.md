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
- `8bfdedd188 docs: report H5C4A implementation`

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

## Review Corrections

### Implementation

- Added an interruptible SDK acquisition boundary that forwards an `AbortSignal` to `Client.connect`, waits for an interrupted acquisition to settle, and idempotently closes a late successful result. Per-server pending ownership also lets Location finalization close a client that completed discovery but was not yet activated.
- Reworked MCP after-hook projection so original `isError`, `_meta`, `structuredContent`, content, and canonical output keys survive text/title/metadata edits. Reserved fields are validated before explicit replacement, metadata additions merge without nesting structured output, and hooks cannot change MCP error state.
- Replaced best-effort stdio termination with awaited, idempotent cleanup. It scans descendants before, during, and after SDK close; runs cleanup after close rejection; sends POSIX SIGTERM, waits 500 ms, escalates survivors with SIGKILL, and awaits Windows `taskkill /T /F`.
- Added one operation semaphore around all public state changes and retained each server semaphore for all-server connect, per-server connect/refresh/disconnect/reconnect, notifications, reload, spontaneous close, and finalization. Adapted tools capture the client that discovered them instead of dereferencing mutable server state.
- Added internal `MCP.reload()` reconciliation over mutable `Config.Service`: removed/replaced tools hide before slow closure, existing server slots remain stable, new slots append, and add/replace/remove operations reconnect through the same locks.
- Moved synchronous MCP call adapter invocation into an `Effect.callback` boundary so synchronous invariant throws remain defects while asynchronous promise rejection maps to `Tool.Failure` and interruption still aborts/awaits the request.
- SSE EventSource fetch now merges transport-generated headers through `Headers`, preserving generated `Accept` and `Last-Event-ID` while configured values override only matching names.
- Added focused coverage for page overflow, sanitized and overlength names, failed refresh preservation/events, status replay/redaction, permission denial, Location shutdown, reconnect/refresh serialization, client identity, malformed hook replacements, process adapters, close rejection, interruption, and a real stubborn grandchild.

### RED Evidence

- `bun test test/mcp-review.test.ts` from `packages/core`: 0 pass, 4 fail. Failures were `MCPClient.interruptible is not a function` twice, `MCPClient.cleanup is not a function`, and missing cleanup/header behavior.
- `bun test test/mcp-service-review.test.ts` from `packages/core`: 3 pass, 4 fail. The failures demonstrated MCP `isError` changing from error to text after a hook, synchronous call exceptions being settled instead of defecting, missing explicit refresh failure publication, and absent `reload` reconciliation timing out while waiting for removal cleanup.

### GREEN Evidence

- `bun test test/mcp-review.test.ts test/mcp-service-review.test.ts test/mcp.test.ts test/mcp-client.test.ts test/location-layer.test.ts` from `packages/core`: 32 pass, 0 fail, 94 assertions.
- `bun test --timeout 10000` from `packages/core`: 1352 pass, 0 fail, 4007 assertions across 148 files.
- `bun test` from `packages/codemode`: 254 pass, 0 fail, 744 assertions.
- `bun run typecheck` from `packages/core`: pass.
- `bun run typecheck` from `packages/server`: pass.
- `bun install --frozen-lockfile` from the repository root: pass, 2372 installs checked, no changes.
- `bunx prettier --check packages/core/src/mcp.ts packages/core/src/mcp/client.ts packages/core/test/mcp-review.test.ts packages/core/test/mcp-service-review.test.ts packages/core/test/mcp-client.test.ts packages/core/test/fixture/mcp-stubborn-server.ts`: pass.
- `git diff --check`: pass.

The first full Core attempt was run concurrently with the other verification jobs and exceeded the shell's 120-second command limit without reporting a test failure. The required standalone rerun completed in 64.73 seconds with 1352 passing tests. An intermediate typecheck exposed an `Effect.fnUntraced` overload error in the uninterruptible close wrapper; replacing it with an explicitly typed plain Effect function produced the final passing Core and server typechecks above.

### Review Commit

- `aed9dd7660 fix(core): harden MCP runtime lifecycle`
