# H5C4B2 Report

## Result

H5C4B2 is implemented in V2 Core. Remote MCP OAuth now has Location/workspace-scoped persistence, SDK-owned discovery/registration/PKCE/exchange/refresh, loopback callbacks, typed internal controls/status/events, authenticated Streamable HTTP with eligible SSE fallback, safe header precedence, restart recovery, and lifecycle cleanup. No public route, browser launch, or V1 runtime delegation was added.

## Design

- `MCPOAuthStore` owns the version-1 store at `Global.data/mcp-oauth/store.json`. The directory is forced to `0700`; the data file and unique same-directory temporary files are forced to `0600`.
- Every store read-modify-write takes one `Flock`, rereads while held, validates the complete nested document, writes and fsyncs a CSPRNG-named `wx` temporary file, atomically renames it, fsyncs the directory, and removes any temporary file. Symlinks and non-regular paths fail with typed safe errors; malformed data is not reset.
- Credential identity is the exact `(Location.directory, workspaceID, effective server name, normalized endpoint)` tuple. `normalizeEndpoint` uses `URL`, permits only credential-free fragment-free HTTP(S), canonicalizes URL serialization, and preserves path, trailing slash, and query distinctions.
- Store entries contain only tokens with absolute expiry, full SDK client registration, SDK discovery state, a non-secret SHA-256 compatibility marker, exact attempt records, and an optional non-secret V1 claim marker.
- The isolated V1 compatibility path reads but never writes `Global.data/mcp-auth.json`. It claims only exact version-2 stable token/client fields into an empty, workspace-less destination with matching directory, name, and normalized endpoint. It never claims verifier/state/transient fields or ambiguous records.
- `MCPOAuthProvider` implements the SDK `OAuthClientProvider`. Static client configuration is authoritative; expired dynamic secrets are unavailable only when expiry is finite, positive, and elapsed. Token writes preserve omitted refresh token/scope and clear stale expiry when `expires_in` is omitted. All five SDK invalidation scopes are implemented.
- `MCPOAuth` owns attempt coordination. IDs use 128 CSPRNG bits with an `mcp_auth_` prefix; state uses 256 bits. Attempts persist ten-minute wall-clock expiry and transition `pending -> received -> exchanging -> complete|failed`, with cancellation/expiry terminals erasing state, verifier, and code.
- Exchange and proactive 60-second-skew refresh use identity-keyed inter-process single-flight locks and reread persisted state after lock acquisition. An interrupted operation keeps Effect interruption and aborts supported fetch work.
- Recovery re-registers unexpired auto callbacks, resumes durable `received` records, and fails `exchanging` records with `indeterminate-exchange`. Graceful Location shutdown cancels owned pending attempts and closes listeners.
- `MCPOAuthCallback` binds explicit literal loopback addresses only, registers exact paths and states, accepts GET only, rejects duplicate/missing/unknown/replayed parameters, and returns fixed non-reflective pages with no-store, CSP, nosniff, and no-referrer headers. HTTPS and non-loopback redirects become manual mode.
- `MCPClient` injects one provider into Streamable HTTP and SSE. Normal connect uses stored credentials and proactive refresh but cannot create an attempt, listener, authorization result, or browser action. Auth-required failures do not fall back; SSE fallback is limited to Streamable HTTP compatibility codes.
- The remote fetch boundary adds configured headers only on the MCP resource origin, removes configured `Authorization` when OAuth is enabled, then overlays generated headers. Bearer, Accept, Content-Type, Last-Event-ID, session, and protocol headers therefore win. `oauth: false` retains prior explicit-header behavior.
- `MCP.Interface` now exposes `authStatus`, `beginAuth`, `completeAuth`, `cancelAuth`, and `removeAuth`. Status/events contain only stable attempt IDs, modes, safe timestamps, and bounded status codes. The authorization URL is returned only by `beginAuth`.
- Existing H5C4A/B1 candidate discovery, hidden tool registration, collision preflight, catalogs, timeout/config publication, stale-client fencing, and close ordering remain on their existing paths.

## Files

- `packages/core/src/config/mcp.ts`: strict endpoint, OAuth client, callback port, and redirect admission.
- `packages/core/src/location-layer.ts`: explicit scoped store/callback/OAuth/client wiring.
- `packages/core/src/mcp.ts`: typed auth controls, status/events, recovery, workspace identity, and lifecycle coordination.
- `packages/core/src/mcp/client.ts`: provider injection, proactive refresh, safe fetch boundary, and restricted fallback.
- `packages/core/src/mcp/oauth-store.ts`: secure versioned persistence, identity, invalidation, and exact V1 claim.
- `packages/core/src/mcp/oauth-provider.ts`: SDK provider and compatibility enforcement.
- `packages/core/src/mcp/oauth-callback.ts`: scoped loopback listener service.
- `packages/core/src/mcp/oauth.ts`: attempt state machine, controls, recovery, exchange, and cleanup.
- `packages/core/src/v1/config/migrate.ts`: keeps arbitrary V1 config migration valid under stricter V2 URL admission; no V1 execution change.
- `packages/core/test/mcp-client.test.ts`: explicit `oauth: false` compatibility fixture.
- `packages/core/test/mcp-oauth-store.test.ts`: identity, permissions, token semantics, invalidation, and V1 claim.
- `packages/core/test/mcp-oauth-provider.test.ts`: static precedence and attempt isolation.
- `packages/core/test/mcp-oauth-callback.test.ts`: real loopback callback and non-reflection.
- `packages/core/test/mcp-oauth-protocol.test.ts`: real OAuth fixture for discovery, S256 PKCE, scope/resource, exchange, cache, refresh, controls, and replay.

## TDD Evidence

### RED

Command from `packages/core`:

```text
bun test test/mcp-oauth-store.test.ts test/mcp-oauth-provider.test.ts test/mcp-oauth-callback.test.ts test/mcp-oauth-protocol.test.ts
```

Result before production implementation: `0 pass`, `5 fail`, `3 errors`, `4 expect() calls`. Representative failures were missing `@slopcode-ai/core/mcp/oauth-{store,provider,callback}` modules, acceptance of an empty static client ID, and configured Authorization/Accept overriding generated transport headers. RED tests were committed first in `230a1724b5`.

### GREEN

The primitive rerun passed `6 pass`, `0 fail`, `29 expect() calls`. The final required focused command passed `83 pass`, `0 fail`, `316 expect() calls` across 12 files:

```text
bun test test/mcp-oauth-store.test.ts test/mcp-oauth-provider.test.ts test/mcp-oauth-callback.test.ts test/mcp-oauth-protocol.test.ts test/mcp-client.test.ts test/mcp.test.ts test/mcp-content.test.ts test/mcp-review.test.ts test/mcp-service-review.test.ts test/location-layer.test.ts test/util/flock.test.ts test/util/effect-flock.test.ts
```

The real protocol fixture passed `4 pass`, `0 fail`, `25 expect() calls`. It asserted RFC 9728 discovery, authorization-server metadata, S256 verifier/challenge correspondence, exact state, protected-resource scope precedence, static client exchange, absolute token storage, discovery cache reuse, refresh, refresh-token/scope preservation, manual downgrade, status, replay rejection, cancellation, and removal.

## Verification

- H5C4A/B1 regression command: `117 pass`, `0 fail`, `473 expect() calls`.
- V1 evidence command from `packages/slopcode`: `40 pass`, `0 fail`, `123 expect() calls`; no V1 files were changed by OAuth runtime work.
- Final full Core command: `1385 pass`, `0 fail`, `4191 expect() calls`, 153 files.
- Full CodeMode command: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.
- `packages/core && bun run typecheck`: exit 0, `tsgo --noEmit`.
- `packages/server && bun run typecheck`: exit 0, `tsgo --noEmit`.
- `packages/slopcode && bun run typecheck`: exit 1 on existing unrelated errors: `src/session/processor.ts:495:17` assigns `Record<string, unknown>` to `string`; `src/session/prompt.ts:1382:39` omits required `actualState` from `SessionRuntime.Mismatch`.
- `bun install --frozen-lockfile`: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- `git diff --check`: pass.
- Source searches under `packages/core/src/mcp` found no V1/session runtime import or call, no `packages/slopcode` reference, and no browser-opening dependency/call. Server source search found no MCP auth route.
- Linux platform; no platform-specific tests were skipped by the focused commands.

One intermediate full Core run exposed stricter V2 endpoint admission breaking arbitrary V1 config generation: `1384 pass`, `1 fail`. The counterexample was a V1 remote server with an empty URL. `2bc1368c20` now drops invalid migrated remotes and safely lowers invalid OAuth fields; the focused config test and all subsequent full runs pass.

## Commits

- `230a1724b5` `test(core): define MCP OAuth security contract`
- `198d84a877` `feat(core): add secure MCP OAuth primitives`
- `f4f4326d50` `feat(core): integrate MCP OAuth lifecycle`
- `d956af69fd` `fix(core): harden MCP OAuth recovery`
- `2bc1368c20` `fix(core): preserve valid MCP config migration`
- `ae6f83c7fd` `fix(core): enforce MCP OAuth compatibility`
- `54ae3f8f75` `feat(core): publish safe MCP auth events`
- `43123c3450` `docs: report H5C4B2 implementation`
- Final hash appendix: the following `docs:` commit containing this line.

## Self-Review

- [x] V2 Core owns the implementation; no V1 MCP/auth/callback runtime delegation exists.
- [x] OAuth applies only to remote MCP; absent/object enables and `false` disables.
- [x] Exact Location Ref, server name, and normalized endpoint identities cannot collide.
- [x] Store schema, permissions, locking, atomic rename, exact claim, and restart behavior fail closed.
- [x] Concurrent attempts have independent IDs/state/verifiers and terminal cleanup is idempotent.
- [x] Auto/manual redirect classification, literal loopback binding, exact path/state, replay rejection, and non-reflection are enforced.
- [x] SDK `auth()` owns discovery, registration, S256 PKCE, exchange, refresh, and invalidation.
- [x] Refresh preserves omitted fields, handles dynamic-secret expiry, uses 60-second skew, and is single-flight.
- [x] Normal connect creates no attempt/listener/browser action and fails typed auth-required.
- [x] Generated transport/auth headers win and configured secrets stay on the MCP resource origin.
- [x] Both transports receive the provider; fallback excludes auth, interruption, and non-compatibility failures.
- [x] Auth controls, statuses, and events are typed, deterministic, and secret-free.
- [x] Reload/remove/shutdown retain H5C4A/B1 hidden publication and stale-client fencing paths.
- [x] Expected OAuth/store/callback failures are typed and sanitized; interruption remains interruption.
- [x] No public route, browser launch, provider-hosted MCP, H6 convergence, or V1 execution behavior was added.
- [x] Focused, V1 evidence, full Core, CodeMode, Core/server typechecks, and frozen install pass.
- [ ] SlopCode package typecheck is not green because of the two unrelated existing session errors recorded above.

## Remaining Concerns

- The required `packages/slopcode` typecheck is red on two pre-existing non-MCP session typing errors. No H5C4B2 file imports or modifies those paths.
