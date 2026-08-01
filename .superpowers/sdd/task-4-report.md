# Task 4 Report: Remote API and workspace routing

## Status

DONE_WITH_CONCERNS

Commit: `feat(server): add remote workspace target routing` (exact hash in final handoff)

## Scope completed

- Implemented typed remote pairing/target contracts in `packages/protocol/src/remote.ts`, including:
  - payload-friendly HttpApi input schemas
  - redacted pairing/host response shapes
  - strict remote target header validation
  - loopback-only remote target URL validation
  - explicit remote capability header contract
- Added real server-side remote pairing persistence and selected-target lookup in `packages/slopcode/src/server/routes/instance/httpapi/remote-pairing.ts`.
- Added authenticated remote workspace routes in `packages/slopcode/src/server/routes/instance/httpapi/groups/workspace.ts` and handlers in `handlers/workspace.ts` for:
  - host listing
  - pairing create/revoke
  - SSH validation handoff
  - target registration
  - pairing selection
- Protected target registration behind a distinct supervisor capability header (`x-slopcode-remote-supervisor-token`) and `SLOPCODE_REMOTE_SUPERVISOR_TOKEN`; ordinary server Basic auth alone is not enough.
- Kept pairing secrets out of ordinary listings: host/pairing list responses are redacted and do not expose reusable pairing codes or registered target headers.
- Wired selected workspace target routing through:
  - shared `/api` routing
  - instance/v1-style workspace routing
  - session-owned message / permission / question routes
  - event SSE
  - PTY HTTP + WebSocket routing
  - session/fs/permission/question/PTY/location handlers
- Added shared server routing support in `packages/server` for route-location propagation and PTY scoping.
- Fail-closed behavior now returns conflict/unavailable responses when a selected remote workspace has no active registered target.
- Proxy sanitization strips forwarded client credentials/private headers before remote forwarding and only applies supervisor-registered remote capability headers.

## Validation / behavior notes

- SSH validation is no longer a fake unauthenticated in-memory stub.
- The server does not directly probe arbitrary SSH destinations itself. Instead, the authenticated desktop supervisor must register the exact validated remote target through the new control-plane endpoint, after which:
  - `select` establishes the active target
  - subsequent routed API calls resolve against that active target
  - missing/unregistered targets fail closed
- This keeps SSRF surface constrained to loopback-only remote bridge URLs plus a distinct supervisor token.

## Focused tests run

From `packages/protocol`:

- `bun run typecheck` ✅
- `bun test test/remote.test.ts` ✅

From `packages/server`:

- `bun run typecheck` ✅

From `packages/slopcode`:

- `bun run typecheck` ✅
- `bun test test/server/httpapi-remote-pairing.test.ts --bail` ✅
- `bun test test/server/httpapi-workspace.test.ts --bail` ✅
- `bun test test/server/httpapi-v2-workspace-routing.test.ts --bail` ✅

Coverage exercised by the focused server tests includes:

- authenticated pairing/host routes
- unauthorized supervisor target registration rejection
- invalid target URL/header rejection
- pairing list redaction / no secret leakage
- selected target propagation into shared `/api` routing
- session-owned route scoping
- SSE event proxying
- PTY WebSocket proxying
- reconnect/backfill fence waiting
- forwarded-header stripping while preserving supervisor-registered capability headers

## Files in this slice

- `packages/protocol/src/remote.ts`
- `packages/server/src/api.ts`
- `packages/server/src/errors.ts`
- `packages/server/src/groups/location.ts`
- `packages/server/src/groups/pty.ts`
- `packages/server/src/handlers.ts`
- `packages/server/src/handlers/pty.ts`
- `packages/server/src/handlers/session.ts`
- `packages/server/src/middleware/authorization.ts`
- `packages/server/src/middleware/route-location.ts`
- `packages/server/src/routes.ts`
- `packages/slopcode/src/server/proxy-util.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/groups/workspace.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/handlers/workspace.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/middleware/server-workspace-routing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/remote-pairing.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/server.ts`
- `packages/slopcode/src/server/shared/workspace-routing.ts`
- `packages/slopcode/test/server/httpapi-instance-context.test.ts`
- `packages/slopcode/test/server/httpapi-promptasync-context.test.ts`
- `packages/slopcode/test/server/httpapi-remote-pairing.test.ts`
- `packages/slopcode/test/server/httpapi-v2-workspace-routing.test.ts`
- `packages/slopcode/test/server/httpapi-workspace-routing.test.ts`
- `packages/slopcode/test/server/httpapi-workspace.test.ts`

## Deferred / concerns

- Desktop / relay / Qt consumption of the new supervisor-target handoff is intentionally deferred. This slice defines the authenticated server contract and routing behavior, but the desktop host still needs to supply the supervisor token and post validated target registrations in production flows.
- New imports were not switched to `@slopcode-ai/protocol` in `packages/server` / `packages/slopcode` because those package manifests do not currently declare that dependency.
- The PTY WebSocket proxy coverage passes, but the underlying Effect/Node server still logs a `Socket already assigned` warning during the successful PTY upgrade path. The test remains green; the warning is worth a follow-up if you want a quieter websocket harness.
