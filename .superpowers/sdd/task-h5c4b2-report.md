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

## Rejected Review Settlement

The rejected review was repaired without changing the V1 runtime or public surfaces.

### Atomic Attempts

- Added lock-scoped `claimAttempt`, `cancelAttempt`, `startExchange`, `finishExchange`, `finishAttempt`, and `cancelTarget` store operations with explicit CAS outcomes.
- Callback delivery now retains its registration until the durable claim succeeds. A failed claim returns a generic failure and remains retryable; a replay after claim is rejected by persisted phase.
- SDK exchange captures tokens in memory. One store transaction now verifies the exchanging winner, preserves refresh/scope semantics, publishes tokens, erases winner transients, and cancels every nonterminal sibling. A losing process rereads phase under the exchange flock and cannot issue another token request or overwrite tokens.
- Deterministic same-attempt claims produced exactly one `claimed` and one `used`; a spawned two-process token race produced exactly `won`/`lost`, one complete attempt, and one cancelled sibling.

### Staged Configuration

- Each MCP server can own an unpublished auth candidate containing candidate config, timeout, and exact target. `authStatus` still gives an active client precedence, while `beginAuth` and completion validation target the candidate when one exists.
- A successful manual or auto completion reconnects and publishes through the serialized MCP replacement path. Failed candidate connection/discovery retains the prior client, config, tools, prompts, resources, timeout, and registrations.
- Endpoint, static client, scope, redirect, callback-port/mode, disable, remove, and subsequent replacement changes cancel exact attempts and invalidate only the incompatible bucket. Stale completion fails target comparison and cannot publish.
- The MCP-level fixture proves a failed new endpoint remains hidden, old tools and connected runtime remain visible, and `beginAuth` receives the new endpoint, client, scope, and redirect.

### Callback Ownership

- Callback ownership is shared by the host callback service across Location-scoped service instances. Server identity includes literal bind address plus port; registration identity includes bind, port, exact path, and state.
- Concurrent server startup and state registration have host reservations, preventing bind and duplicate-state races. Service close is scoped/refcounted and cannot close another Location's registrations.
- IPv4 and IPv6 listeners are distinct, occupied external ports fail safely, duplicate state/code parameters fail, provider errors remain non-reflective, and rejected durable claims remain registered.
- Auto completion notifies MCP through an internal callback. MCP fences the exact staged target, serializes candidate preparation/activation, and publishes a safe auth event after reconnect without introducing an import cycle.

### Closed Store Schema

- Replaced permissive nested checks with closed field sets for data, buckets, identities, entries, tokens, dynamic registration, discovery, authorization-server metadata, protected-resource metadata, and attempts.
- Decode verifies the bucket key from explicit identity dimensions, exact normalized endpoint serialization, safe nested URLs, finite nonnegative timestamps, required attempt metadata/phase fields, and phase-specific transient presence/absence.
- Writes validate before touching disk. Existing symlink/nonregular checks, mode repair, unique `wx` temporary files, fsync/rename, directory fsync, interruption-aware flocking, and temp cleanup remain enforced.
- V1 claim now requires an exact closed version-2 document, exact bucket key/identity, exact normalized server key, exact stable field schemas, one match, and no workspace. Malformed/unknown/ambiguous data remains untouched and unclaimed.

### Noninteractive Connect And Fetch

- Normal OAuth connect reads and checks exact compatibility plus usable access/refresh material before provider construction. No credentials returns typed `auth-required` with zero network requests and no store file.
- The connect provider is explicitly noninteractive and transient-disabled. It cannot persist verifier/state or create attempts, and its redirect callback always fails closed.
- Outer lifecycle, SDK request, and `Request` AbortSignals are merged with `AbortSignal.any`. Closing a returned connection aborts the lifecycle signal before SDK close, covering active Streamable HTTP/SSE work.
- Configured-header requests use manual redirects. Same-origin redirects are bounded; cross-origin redirects strip all configured header names and bearer authorization. SDK authorization-server requests never receive resource configured headers.

### Cleanup And Status

- All newly begun and recovered auto/manual attempts are owned. Graceful shutdown, reset, disable, remove, replacement, terminal completion, and expiry close listeners and erase transient state idempotently.
- Store-only status now reports internal `credential-ready`, never `connected`. Public `connected` is derived only from `server.client`; expired/incompatible credentials produce auth-required/authorizing behavior and cannot short-circuit `beginAuth`.

### Review RED Evidence

All commands ran from `packages/core`.

```text
bun test test/mcp-oauth-store.test.ts test/mcp-oauth-callback.test.ts test/mcp-oauth-protocol.test.ts
```

Initial review RED: `7 pass`, `4 fail`, `44 expect() calls`. Failures were missing atomic store methods, unknown nested fields being accepted, Location-local callback port contention, and store credentials reporting connected.

```text
bun test test/mcp-client.test.ts
```

Transport RED: `4 pass`, `2 fail`, `20 expect() calls`. Missing credentials made a network request and returned generic OAuth failure; a configured `X-Secret` crossed an origin redirect.

```text
bun test test/mcp-oauth-protocol.test.ts
```

Replacement RED: `4 pass`, `1 fail`, `26 expect() calls`. A scope/redirect-incompatible second begin left the first attempt pending instead of cancelling it.

```text
bun test test/mcp-service-review.test.ts
```

Staged-control RED: `23 pass`, `1 fail`, `98 expect() calls`. With the old client still active after failed candidate connection, `beginAuth` returned old `connected` instead of the candidate's `authorizing` result.

### Review GREEN Evidence

- Required focused command: `94 pass`, `0 fail`, `363 expect() calls`, 12 files.
- H5C4A/B1 regression command: `120 pass`, `0 fail`, `482 expect() calls`, 8 files.
- Final full Core: `1396 pass`, `0 fail`, `4238 expect() calls`, 153 files.
- Full CodeMode: `254 pass`, `0 fail`, `744 expect() calls`, 7 files.
- V1 OAuth evidence: `40 pass`, `0 fail`, `123 expect() calls`, 5 files.
- Core typecheck: exit 0, `tsgo --noEmit`.
- Server typecheck: exit 0, `tsgo --noEmit`.
- Frozen install: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- SlopCode typecheck: exit 1 on the same unrelated diagnostics: `src/session/processor.ts(495,17)` assigns `Record<string, unknown>` to `string`; `src/session/prompt.ts(1382,39)` omits required `actualState` from `SessionRuntime.Mismatch`.
- Source assertions: no V1/session MCP runtime import or call under `packages/core/src/mcp`, no browser launcher, and no server MCP auth route.
- Linux IPv4 and IPv6 callback tests both ran and passed; no platform-specific OAuth test was skipped.

### Review Commits

- `622af0e8de` `test(core): expose MCP OAuth review races`
- `b0b493924f` `test(core): expose MCP OAuth transport leaks`
- `571c8c710a` `test(core): expose MCP OAuth replacement cleanup`
- `43e7ab703f` `fix(core): harden MCP OAuth lifecycle`
- `b85bf92f64` `fix(core): close MCP OAuth recovery gaps`
- `500017fd73` `test(core): cover MCP OAuth host security`
- Review report commit: the following `docs:` commit containing this appendix.

### Review Concerns

- The unrelated SlopCode package typecheck failures above remain outside H5C4B2. All H5C4B2-focused, preservation, full Core, V1 evidence, CodeMode, Core/server typecheck, and dependency gates pass.

## Second Re-review Settlement

### RED Evidence

- Re-review boundary command (`mcp-client`, `mcp-oauth-protocol`, `mcp-oauth-callback`): `15 pass`, `2 fail`, `69 expect() calls`. Config accepted `callback_port` with an incompatible HTTPS redirect and runtime classified the conflict as discovery instead of typed `invalid-redirect`.
- Read-only provider command (`mcp-oauth-provider`): `1 pass`, `1 fail`, `5 expect() calls`. `MCPOAuthProvider.connect` did not exist, proving normal transport still received the mutation-capable provider.
- First final full Core run after adding cross-process SDK evidence: `1404 pass`, `1 fail`, `4277 expect() calls`. The sibling workers made two token requests. The token request was under the exchange flock, but winner publication happened after releasing it.

### Repairs

- Added a snapshot-only connect provider. It has no redirect URL, client-registration writer, discovery writer, invalidation hook, state, or verifier persistence. Token save is inert and redirect/verifier requests fail closed. Normal 401 handling returns bounded `auth-required` without changing exact store bytes.
- Kept mutation-capable OAuth exclusively in proactive refresh and explicit begin/complete flows. Refresh now has a service-scoped in-process reservation in addition to the process flock, and the Location client layer requires the exact injected OAuth store rather than silently falling back to global storage.
- Expanded closed validation for token numeric/string fields, registration timestamps/arrays/URLs/JWK JSON, authorization-server and OIDC arrays/booleans/URLs, protected-resource arrays/booleans/URLs, bounded attempt failures, compatibility hashes, claim literals, canonical legacy keys, and closed `legacy`/`recoverable` entries.
- Config and runtime now reject every mixed callback-port/manual redirect, default-port redirect, and explicit mismatched-port case. Runtime parsing is wrapped in `Effect.try` and emits input-independent `invalid-redirect`.
- Replaced callback module state with explicit `HostService` ownership above Location layers. Per-Location leases share the injected host service and retain exact bind/port/path/state isolation.
- Public begin results are exactly `connected | authorizing`; failed reconnect produces bounded `connection`. Failed status codes use the closed `FailureCode` schema.
- `removeAuth` closes the runtime and removes both distinct candidate and active OAuth targets while preserving unrelated targets.
- Listener close is awaited for cancel, terminal API paths, shutdown, reset, and removal. Callback-handler completion defers the final listener close until after the HTTP response to avoid self-deadlock.
- Winner token publication and sibling cancellation now execute inside the same process flock as the SDK token request. Ten repeated protocol runs produced exactly one token request and one winner every time.

### Added Evidence

- Exact rejected-token store bytes before and after normal connect are identical; no well-known discovery or registration request occurs.
- Closed nested-schema mutation matrix rejects malformed token, client registration, authorization/OIDC metadata, protected-resource metadata, attempts, legacy fields, unknown fields, and noncanonical identities.
- Dynamic registration replaces an expired client secret; OIDC discovery fallback is exercised against a real HTTP fixture.
- Spawned sibling processes run the real SDK authorization-code exchange and produce exactly one token request.
- Callback cancellation awaits close and permits immediate same-port reuse.
- Real Streamable HTTP POST/GET requests assert JSON/event-stream headers; real SSE event GET and message POST assert their respective accept/content-type behavior.
- Dual active/candidate removal and bounded public status decoding are asserted at the integrated MCP service boundary.

### Final Verification

- Focused 12-file command: `103 pass`, `0 fail`, `402 expect() calls`.
- Cross-process protocol stress (`--rerun-each 10`): `100 pass`, `0 fail`, `460 expect() calls`.
- H5C4A/B1 preservation command: `121 pass`, `0 fail`, `487 expect() calls`.
- Full Core after the final lock-scope fix: `1405 pass`, `0 fail`, `4277 expect() calls`, 153 files.
- Full CodeMode: `254 pass`, `0 fail`, `744 expect() calls`.
- V1 OAuth evidence: `40 pass`, `0 fail`, `123 expect() calls`.
- Core typecheck: exit 0.
- Server typecheck: exit 0.
- Frozen install: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- SlopCode typecheck remains red only at the two unrelated existing session diagnostics: `src/session/processor.ts(495,17)` and `src/session/prompt.ts(1382,39)`.

### Second Re-review Commits

- `6f2e19296e` `test(core): expose remaining MCP OAuth boundaries`
- `f66b418ee8` `fix(core): close MCP OAuth review gaps`
- `fbab28c9a6` `test(core): cover MCP OAuth OIDC fallback`
- `1496460ecc` `fix(core): serialize MCP OAuth refresh`
- `4e5a0fffa5` `fix(core): commit OAuth exchange under lock`
- Report appendix: the following `docs:` commit.
