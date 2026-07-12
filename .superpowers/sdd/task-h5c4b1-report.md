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
