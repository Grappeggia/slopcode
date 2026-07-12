# H5C4B1 Implementation Report

## Design And API Decisions

- `MCPClient.Connection` now exposes capability-gated `listPrompts`, `getPrompt`, `listResources`, `readResource`, `promptsChanged`, and `resourcesChanged` primitives using MCP SDK result types and request options.
- `MCP.Interface` exposes Location-scoped `prompts`, `resources`, `getPrompt`, and `readResource`. `MCP.resolveAndAdmit` is an internal composition over `MCP.Interface` and `SessionV2.Interface`; this avoids a Location/session layer cycle and delegates exactly once to ordinary `SessionV2.prompt`.
- Prompt and resource canonical names use `<sanitize(server)>:<sanitize(raw-name)>`. The sanitizer is the existing Core MCP sanitizer. Catalog entries retain `server`, `rawName`, and useful SDK fields.
- Prompt and resource catalogs are separate namespaces. The same canonical name may exist once in each namespace. Duplicate raw names, same-server sanitized collisions, and cross-server canonical collisions fail the affected complete catalog publication. They do not alter tool registration or the other content namespace.
- Discovery preserves effective server order and each server's page/item order. Pagination rejects repeated cursors and more than 1000 pages.
- Prompt text uses `[user]\n...` and `[assistant]\n...`; messages are separated by `\n\n---\n`. Empty text is retained. Direct resource text items use the same unambiguous separator.
- Supported embedded/direct resource URI schemes are `file:`, `http:`, and `https:`. URI validation uses `URL`; relative, malformed, and other schemes fail closed.
- MIME values must match a strict `type/subtype` token form. Images require `image/*`; blobs require MIME. Canonical base64 must round-trip exactly. Text/blob conflicts and unsupported content types fail closed.
- Embedded textual resources become prompt text. Images and blobs become V2 `FileAttachment` data URIs. Resource URI paths provide attachment names where available. No lazy reads or binary placeholders are used.
- Expected remote errors become redacted `MCP.RequestError`; normalization failures become safe `MCP.ContentError`. Neither includes prompt arguments, bodies, blobs, configured headers, nor environment values.

## Files Changed

- `packages/core/src/mcp/client.ts`: typed SDK prompt/resource requests, capability checks, and list-changed handlers.
- `packages/core/src/mcp.ts`: catalogs, pagination, collisions, lifecycle refresh/fencing, typed get/read, normalization, and resolve-and-admit.
- `packages/core/test/mcp-content.test.ts`: normalization, validation, capability gating, and admission forwarding.
- `packages/core/test/mcp-client.test.ts`: real SDK prompt/resource wire operations.
- `packages/core/test/mcp.test.ts`: paginated catalogs, separate namespaces, notifications, timeout forwarding, and failed-refresh retention.
- `packages/core/test/fixture/mcp-server.ts`: real SDK prompt and resource fixtures.

## TDD Evidence

RED command:

```text
cd packages/core && bun test test/mcp-content.test.ts
```

RED result: `0 pass`, `3 fail`, `4 expect() calls`. Representative failures were `MCP.normalizePrompt is not a function`, `MCP.normalizeResources is not a function`, and `client.promptsChanged is not a function`. This evidence was committed before production changes in `bbd5740b03`.

GREEN focused command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

GREEN result after final review fix: `72 pass`, `0 fail`, `288 expect() calls`, 6 files.

## Full Verification

```text
cd packages/core && bun test
```

Result after final review fix: `1363 pass`, `0 fail`, `4064 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd ../.. && bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

An accidental workspace-root `bun run typecheck` was also attempted while formatting the final review fix. It is not a contract verification command and failed in the pre-existing TUI fixture `packages/tui/test/cli/tui/data.test.tsx:264` because `toolType` is missing. The required Core and server package typechecks above both pass.

## Contract Evidence

- Lifecycle: prompt/resource snapshots are cleared in the same `hide` operation as tools before transport close. Connect, reconnect, reload, disconnect, unexpected close, and finalization all use the existing serialized close/activate paths. Initial content discovery failures publish redacted discovery failures while preserving tool activation.
- Atomicity: explicit and notification refreshes validate complete snapshots before assignment; failures retain prior snapshots. Stale notification callbacks check client identity before discovery and before publication.
- Interruption: paginated list and direct get/read requests run through an Effect callback with an `AbortController`; interruption aborts and waits for request settlement. Existing tool interruption remains unchanged.
- Redaction: service errors and discovery events pass through configured header/environment redaction. Content errors carry only safe server/canonical-item/validation labels.
- Transaction guard: `resolveAndAdmit` resolves first and forwards the caller's guard unchanged to the sole `SessionV2.prompt` call. Focused tests prove option/guard forwarding; existing `session-prompt.test.ts` proves transaction-time guard rejection, no admission/wake, idempotency, and prompt conflict behavior.
- V1 isolation: searches for `packages/slopcode`, `/v1/`, `SessionV1`, and `ConfigV1` in `packages/core/src/mcp.ts` and `packages/core/src/mcp/*.ts` returned no matches. No V1 file was changed.

## Commits

- `bbd5740b03` `test(core): define MCP content contract`
- `de98298171` `feat(core): add MCP prompt and resource content`
- `0a8386f051` `fix(core): isolate MCP content discovery failures`
- Report commit: the `docs:` commit containing this file.

## Self-Review

- [x] No V1 import or runtime call exists in the V2 path.
- [x] Capability checks precede protocol operations and handler registration.
- [x] Pagination is bounded at 1000 pages and rejects repeated cursors.
- [x] Canonical names, deterministic ordering, collisions, and separate namespaces are explicit.
- [x] Catalog collisions and failed refreshes are atomic and tool-safe.
- [x] List-changed callbacks are client-fenced and retain valid snapshots on failure.
- [x] Connect/reconnect/refresh/reload/disconnect/close/finalizer paths cover all catalogs.
- [x] Expected failures are typed and redacted; interruption remains interruption.
- [x] URI, MIME, base64, image, blob, and content shapes fail closed.
- [x] Normalization produces only one V2 `Prompt` with deterministic text/files.
- [x] Resolve-and-admit delegates once and forwards the guard unchanged.
- [x] Existing durable admission tests prove guard failure leaves no admission or wake.
- [x] Existing MCP tool, collision, refresh, lifecycle, interruption, and CodeMode tests pass.
- [x] No OAuth, public route, SDK generation, CLI, TUI, web, or V1 execution change was added.

## Remaining Concerns

None for H5C4B1. The unrelated workspace-root TUI typecheck failure is recorded above and does not affect the required package checks.

## Rejection Fixes

### Findings Resolved

- Cross-server content collisions now abort prepared replacements as a complete batch while retaining the prior client, tool registration, prompt snapshot, resource snapshot, and connected status. New servers may still activate tool-safe with the failed catalog unpublished. Discovery failure during replacement follows the same retention path.
- Reload no longer closes replaced clients before discovery and batch preflight. Successful replacement installs first, then synchronously publishes the new client and snapshots before closing the old transport.
- Prompt/resource snapshots and their owning `server.client` are assigned without an Effect yield, preventing catalog readers from observing unresolvable entries.
- Resource normalization uses own-field presence for `text`/`blob`, rejects both/neither even when one is wrongly typed, validates selected field types, and rejects unsupported extra fields.
- Prompt text, image, and embedded-resource content enforce exact supported field sets before normalization.
- Direct tests now cover content pagination repetition/overflow, duplicate raw/sanitized names, cross-server timing-independent collision replacement, failed replacement retention, stale callbacks, lifecycle hiding, request interruption, typed/redacted failures, strict normalization shapes, and real durable resolve-and-admit guard/idempotency/conflict behavior.

### Review RED Evidence

Command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/session-prompt.test.ts
```

Result before fixes: `40 pass`, `1 fail`, `179 expect() calls`. Representative failure: the new field-presence test expected `MCP.ContentError`, but `{ uri: "file:///x", text: "x", blob: 1 }` was accepted and returned `Prompt({"text":"x","files":[]})`.

The RED tests were committed in `4133a53ab4` before the production fix.

### Review GREEN Evidence

Covering command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

Result after fixes: `79 pass`, `0 fail`, `333 expect() calls`, 6 files.

Required broad verification after fixes:

```text
cd packages/core && bun test
```

Result: `1370 pass`, `0 fail`, `4109 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd ../.. && bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

### Review Fix Commits

- `4133a53ab4` `test(core): cover rejected MCP content contracts`
- `79d21daeba` `fix(core): make MCP content replacement atomic`
- Report update: the following `docs:` commit containing this appendix.

### Post-Fix Concerns

None.

## Re-Review Replacement Fixes

### Findings Resolved

- Reload now creates staged replacement descriptors containing candidate config and timeout. Active `server.config` and `server.timeout` remain unchanged throughout connection, discovery, collision preflight, and failure cleanup.
- Candidate config, timeout, client, tool definitions, prompt snapshot, and resource snapshot publish together only after successful validation and installation. Failed replacement continues using the old timeout and old secret set.
- Failure redaction applies both candidate and active config secrets without mutating active state.
- Servers retain their active raw tool definitions. Replacement closure is checked after adaptation and before tool registration. If closure occurs during/after registration, the old definitions are reinstalled before the candidate is closed, restoring the old client/tool/catalog/config/timeout/status runtime.
- Resource discovery now has direct parity tests for repeated cursor, 1000-page overflow, duplicate raw names, sanitization collisions, and stale resource list-changed callbacks.

### Re-Review RED Evidence

Command:

```text
cd packages/core && bun test test/mcp-service-review.test.ts
```

Result before fixes: `17 pass`, `2 fail`, `73 expect() calls`. Representative failures:

- Failed replacement retained the old client but used timeout `222` instead of old timeout `111`.
- A deterministic close from the replacement tool schema left `closed_new` registered instead of `closed_old`.

The RED tests were committed first in `deaffca032`.

### Re-Review GREEN Evidence

Focused command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

Result: `80 pass`, `0 fail`, `344 expect() calls`, 6 files.

Broad verification:

```text
cd packages/core && bun test
```

Result: `1371 pass`, `0 fail`, `4120 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd ../.. && bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

### Re-Review Commits

- `deaffca032` `test(core): cover MCP replacement staging races`
- `05a99d871f` `fix(core): stage complete MCP replacements`
- Report update: the following `docs:` commit containing this section.

### Re-Review Concerns

None.

## Final Review Replacement Fixes

### Findings Resolved

- Candidate `tools/list`, `prompts/list`, and `resources/list` discovery now consistently uses the staged replacement timeout while active config and timeout remain unchanged until publication.
- Enabled-to-disabled reload atomically hides tools, prompts, and resources, publishes disabled status/config, and then awaits old pending/client cleanup. Slow close therefore cannot expose stale catalogs.
- Every successful replacement installs its complete tool snapshot. A content-only replacement installs an empty registration, removing old tools before the new client and content catalogs publish and before the old client closes.

### Final Review RED Evidence

The committed tests were replayed against pre-fix commit `c916abac6b` in an isolated worktree.

Command:

```text
cd packages/core && bun test test/mcp-service-review.test.ts
```

Result: `18 pass`, `3 fail`, `79 expect() calls`, 1 file. The deterministic failures were:

- Expected staged tool-list timeout `222`; received active timeout `111`.
- Expected old client slow-close cleanup to start during enabled-to-disabled reload; received `false` while stale runtime remained visible.
- Expected no registered tools after tool-to-content-only replacement; received stale `contentOnly_old`.

The RED tests were committed first in `c916abac6b`.

### Final Review GREEN Evidence

Focused command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

Result: `82 pass`, `0 fail`, `353 expect() calls`, 6 files.

Broad verification:

```text
cd packages/core && bun test
```

Result: `1373 pass`, `0 fail`, `4129 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

### Final Review Commits

- `c916abac6b` `test(core): cover final MCP replacement gaps`
- `00327390d8` `fix(core): complete MCP replacement transitions`
- Report update: the following `docs:` commit containing this section.

### Final Review Concerns

None.

## Atomic Publication Review Fixes

### Findings Resolved

- ToolRegistry registrations can now carry a visibility predicate. Same-slot generations coexist while staged, and materialization selects the newest visible generation, preserving the prior registration and its captured identity until publication.
- MCP tool installation now returns a hidden staged registration. Candidate liveness is checked after registration, and the tool generation becomes visible in the same no-yield publication block as client, config, timeout, prompt, and resource ownership. Failed candidates close only their hidden stage and never expose candidate tools.
- Enabled-to-disabled reload now hides catalogs/tools and publishes disabled config/status before starting any unrelated replacement discovery. Old runtime cleanup runs concurrently with discovery after stale visibility has been removed.

### Atomic Publication RED Evidence

Command:

```text
cd packages/core && bun test test/mcp-service-review.test.ts
```

Result before fixes: `21 pass`, `2 fail`, `90 expect() calls`, 1 file. Deterministic failures:

- A synchronous observer inside replacement registration materialized both `atomic_old` and transient `atomic_new` after closing the candidate.
- While unrelated replacement discovery was blocked, materialization still contained `orderedDisabled_tool` and the disabled server catalogs remained published.

The RED tests were committed first in `304e962db0`.

### Atomic Publication GREEN Evidence

Exact focused command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

Result: `84 pass`, `0 fail`, `360 expect() calls`, 6 files.

Additional ToolRegistry, slot, staleness, and lifecycle command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts test/plugin-tool.test.ts test/session-runner-tool-registry.test.ts
```

Result: `116 pass`, `0 fail`, `470 expect() calls`, 8 files.

Broad verification:

```text
cd packages/core && bun test
```

Result: `1375 pass`, `0 fail`, `4136 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

### Atomic Publication Commits

- `304e962db0` `test(core): expose MCP publication race`
- `5aa335cf44` `fix(core): fence MCP tool publication`
- Report update: the following `docs:` commit containing this section.

### Atomic Publication Concerns

None.

## Visible Settlement Review Fix

### Finding Resolved

- ToolRegistry now uses one newest-visible-generation selector for both materialization and settlement identity checks. Hidden same-slot MCP stages no longer make active captures stale; publishing the stage immediately makes prior captures stale as intended.

### Visible Settlement RED Evidence

Command:

```text
cd packages/core && bun test test/session-runner-tool-registry.test.ts
```

Result before the fix: `19 pass`, `1 fail`, `40 expect() calls`, 1 file. The hidden same-slot generation caused the prior visible materialization to return `Stale tool call: echo` before publication instead of successfully settling.

The RED test was committed first in `6ba9c1765e`.

### Visible Settlement GREEN Evidence

Exact focused command, rerun in isolation to avoid cross-process SQLite fixture contention:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts
```

Result: `84 pass`, `0 fail`, `360 expect() calls`, 6 files.

Extended ToolRegistry/MCP command:

```text
cd packages/core && bun test test/mcp-content.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/session-prompt.test.ts test/plugin-tool.test.ts test/session-runner-tool-registry.test.ts
```

Result: `117 pass`, `0 fail`, `473 expect() calls`, 8 files.

Broad verification:

```text
cd packages/core && bun test
```

Result: `1376 pass`, `0 fail`, `4139 expect() calls`, 149 files.

```text
cd packages/codemode && bun test
```

Result: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.

```text
cd packages/core && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
cd packages/server && bun run typecheck
```

Result: exit 0, `tsgo --noEmit`.

```text
bun install --frozen-lockfile
```

Result: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.

### Visible Settlement Commits

- `6ba9c1765e` `test(core): cover staged tool settlement`
- `0af16f7ba7` `fix(core): settle visible tool generation`
- Report update: the following `docs:` commit containing this section.

### Visible Settlement Concerns

None.
