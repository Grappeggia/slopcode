# H5C4B2 Report

## Result

H5C4B2 is implemented in V2 Core. Remote MCP OAuth now has Location/workspace-scoped persistence, durable `initializing -> pending -> received -> exchanging -> terminal` attempts, SDK-owned discovery/registration/PKCE/exchange/refresh, loopback callbacks, typed internal controls/status/events, provider-free access-token snapshot resource transports, safe header precedence, restart recovery, and abort-before-close lifecycle cleanup. No public route, browser launch, or V1 runtime delegation was added.

## Design

- `MCPOAuthStore` owns the version-1 store at `Global.data/mcp-oauth/store.json`. The directory is forced to `0700`; the data file and unique same-directory temporary files are forced to `0600`.
- Every store read-modify-write takes one `Flock`, rereads while held, validates the complete nested document, writes and fsyncs a CSPRNG-named `wx` temporary file, atomically renames it, fsyncs the directory, and removes any temporary file. Symlinks and non-regular paths fail with typed safe errors; malformed data is not reset.
- Credential identity is the exact `(Location.directory, workspaceID, effective server name, normalized endpoint)` tuple. `normalizeEndpoint` uses `URL`, permits only credential-free fragment-free HTTP(S), canonicalizes URL serialization, and preserves path, trailing slash, and query distinctions.
- Store entries contain only tokens with absolute expiry, full SDK client registration, SDK discovery state, a non-secret SHA-256 compatibility marker, exact attempt records, and an optional non-secret V1 claim marker.
- The isolated V1 compatibility path reads but never writes `Global.data/mcp-auth.json`. It claims only exact version-2 stable token/client fields into an empty, workspace-less destination with matching directory, name, and normalized endpoint. It never claims verifier/state/transient fields or ambiguous records.
- `MCPOAuthProvider` implements the SDK `OAuthClientProvider` only for interactive initialization/exchange and explicit noninteractive refresh. Static client configuration is authoritative; expired dynamic secrets are unavailable only when expiry is finite, positive, and elapsed. Token writes preserve omitted refresh token/scope and clear stale expiry when `expires_in` is omitted. All five SDK invalidation scopes are implemented.
- `MCPOAuth` owns attempt coordination. IDs use 128 CSPRNG bits with an `mcp_auth_` prefix; state uses 256 bits. Attempts persist ten-minute wall-clock expiry and transition `initializing -> pending -> received -> exchanging -> complete|failed`, with cancellation/expiry terminals erasing state, verifier, code, and authorization URL. `pending` is published only after the verifier and exact authorization URL are durable.
- Exchange and proactive 60-second-skew refresh use identity-keyed inter-process single-flight locks and reread persisted state after lock acquisition. Active callback exchanges are tracked by attempt with an abort controller and settlement promise. Remove, reset, stop, reload, disable, replacement, and Location shutdown abort exchanges, await settlement, terminalize once, then close listeners.
- Every owned initializing/pending attempt has a wall-clock expiry timer derived from its persisted expiry. Recovery terminalizes `initializing` and indeterminate `exchanging`, re-registers unexpired auto callbacks, schedules their remaining duration, and resumes durable `received` records. Fresh and recovered callback failures share terminal scrubbing and reliably scheduled registration cleanup.
- `MCPOAuthCallback` binds explicit literal loopback addresses only, registers exact paths and states, accepts GET only, rejects duplicate/missing/unknown/replayed parameters, and returns fixed non-reflective pages with no-store, CSP, nosniff, and no-referrer headers. HTTPS and non-loopback redirects become manual mode.
- `MCPClient` passes no OAuth provider to Streamable HTTP or SSE. After explicit proactive refresh, it snapshots only the access token and injects bearer authorization at the resource fetch boundary. Refresh interaction maps to typed `auth-required`; other refresh failures map to bounded `refresh`. Normal connect cannot create an attempt, listener, authorization result, or browser action. Auth failures do not fall back; SSE fallback is limited to Streamable HTTP compatibility codes.
- The remote fetch boundary adds configured headers only on the MCP resource origin, removes configured `Authorization` when OAuth is enabled, then overlays generated headers. Bearer, Accept, Content-Type, Last-Event-ID, session, and protocol headers therefore win. `oauth: false` retains prior explicit-header behavior.
- `MCP.Interface` now exposes `authStatus`, `beginAuth`, `completeAuth`, `cancelAuth`, and `removeAuth`. Status/events contain only stable attempt IDs, modes, safe timestamps, and bounded status codes. The authorization URL is returned only by `beginAuth`.
- Existing H5C4A/B1 candidate discovery, hidden tool registration, collision preflight, catalogs, timeout/config publication, stale-client fencing, and close ordering remain on their existing paths.

## Files

- `packages/core/src/config/mcp.ts`: strict endpoint, OAuth client, callback port, and redirect admission.
- `packages/core/src/location-layer.ts`: explicit scoped store/callback/OAuth/client wiring.
- `packages/core/src/mcp.ts`: typed auth controls, status/events, recovery, workspace identity, and lifecycle coordination.
- `packages/core/src/mcp/client.ts`: provider-free access-token snapshot transport, proactive refresh, safe fetch boundary, and restricted fallback.
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
- [x] Both resource transports receive only an access-token snapshot; fallback excludes auth, interruption, and non-compatibility failures.
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
- Normal resource connect is provider-free. Explicit proactive refresh alone uses a noninteractive provider whose redirect callback throws typed `AuthRequired`; it cannot create attempts or listeners.
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

- Replaced the intermediate snapshot-provider design with a provider-free access-token snapshot passed directly to the resource fetch boundary. Normal 401 handling returns bounded `auth-required` without changing exact store bytes.
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

## Final Review Settlement

### Final RED Evidence

- Initial readiness/rejection/store command: `23 pass`, `5 fail`, `1 test-file syntax error`, `119 expect() calls`. Behavioral failures showed pending attempts without an authorization URL, initializing attempts rejected by persistence, pending accepted without a verifier, and rejected credentials never reaching the seeded resource because the injected test store was not actually consumed. The syntax-only provider assertion was corrected before implementation evidence was accepted.
- Minimal connect-provider command after the assertion correction: `1 pass`, `1 fail`, `7 expect() calls`. `clientInformation` remained exposed from normal-connect credentials.
- V1 migration counterexample: `0 pass`, `1 fail`, 14 tests filtered. The migrated external redirect retained `callback_port: 19876` and failed V2 decoding.
- Store/rejected-resource rerun after schema work: `15 pass`, `1 fail`, `81 expect() calls`. The remaining failure proved the test layer was not invoking the seeded store, leading to the explicit `MCPClient.layerWith(store)` construction used by all credential-path integration tests.

### Final Repairs

- Added durable `initializing` attempts. Only `readyAttempt` can atomically publish `pending`, and it requires state, mode, redirect, created/expires, a persisted verifier, and the exact authorization URL.
- Closed attempt validation now distinguishes initializing, ready pending, received/exchanging, and scrubbed terminal phases. Pending without verifier or authorization is invalid.
- Initialization interruption and restart both terminalize `initializing` as bounded discovery failure and erase state/verifier/code/authorization. Recovery never installs a listener for an initializing flow.
- Normal transport receives no SDK OAuth provider. It receives only a snapshotted access token injected into resource requests. Refresh tokens, client registration, discovery, redirect, verifier, state, save, and invalidation hooks are absent. A resource 401 throws typed `auth-required` before SDK OAuth processing.
- Proactive refresh remains before transport construction, persists refreshed tokens, uses an in-process reservation plus process flock, and rereads durable state inside the flock.
- Automatic exchanges own attempt-keyed abort controllers and settlement promises in the Location service. Teardown aborts and awaits token fetch work before one terminal CAS and listener release; callback failure scrubs transients.
- V1 migration now retains `callback_port` only for an explicit matching loopback HTTP redirect; external/manual and default-port redirects drop it deterministically.
- Added explicit `MCPClient.layerWith(store)` so seeded credential integration tests cannot silently exercise the global fallback store.

### Final Coverage

- Successful begin persists `pending` only with verifier and returned authorization URL.
- Restart terminalizes an initializing flow without listener rehydration.
- Interruption during never-settling initialization leaves one scrubbed failed attempt.
- Rejected access token with refresh token, absent discovery cache, and expired dynamic registration makes exactly one `/mcp` request, returns bounded `auth-required`, and preserves exact store bytes.
- Failed automatic token exchange returns callback 400, records scrubbed exchange failure, and permits immediate port reuse.
- Location shutdown aborts a never-settling exchange, settles callback 400, scrubs the attempt, and permits immediate port reuse.
- In-process refresh makes exactly one token request while an interrupted waiter cannot cancel the owner.
- Two spawned refresh processes make exactly one token request and observe the durable refreshed token.
- Real Streamable HTTP traffic verifies bearer precedence, MCP session ID, protocol version, SSE retry/resumption, and `Last-Event-ID: event-1`.
- Real OAuth SSE traffic verifies access-token precedence over configured authorization while preserving configured non-secret headers and SDK-generated event/message headers.
- Store tests interrupt a flock waiter, preserve 20 concurrent independent fields, and repair directory/file modes to 0700/0600.
- The arbitrary V1 migration property remains green and the external redirect counterexample decodes under V2.

### Final Results

- Focused 13-file command: `126 pass`, `0 fail`, `507 expect() calls`.
- H5C4A/B1 preservation command: `124 pass`, `0 fail`, `499 expect() calls`.
- Full Core: `1414 pass`, `0 fail`, `4304 expect() calls`, 153 files.
- Full CodeMode: `254 pass`, `0 fail`, `744 expect() calls`.
- V1 OAuth evidence: `40 pass`, `0 fail`, `123 expect() calls`.
- Core typecheck: exit 0.
- Server typecheck: exit 0.
- Frozen install: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- SlopCode typecheck remains red only at the unrelated existing `src/session/processor.ts(495,17)` and `src/session/prompt.ts(1382,39)` diagnostics.

### Final Review Commits

- `cde04968e1` `test(core): expose final MCP OAuth lifecycle gaps`
- `40ac3310ce` `fix(core): finalize MCP OAuth lifecycle`
- `c75c28e869` `test(core): cover final MCP OAuth recovery`
- Final report appendix: the following `docs:` commit.

## Approval Review Settlement

### Approval RED Evidence

- The first approval protocol run was `15 pass`, `1 fail`, `66 expect() calls`. A just-expired pending attempt was durably terminalized but the same first `status` call returned `auth-required` because it continued using the stale pre-terminalization entry and ignored phase `expired` when selecting the latest failure.
- The first bounded-refresh fixture run was `0 pass`, `1 fail`, `6 expect() calls`; it additionally exposed an invalid throwing server fixture, which was replaced with protocol responses before accepting refresh evidence.
- `d916301b77` committed the active-exchange, recovered-failure, refresh, expiry, and spawned-process contracts before the production fix commit. The parent implementation closed listeners before awaiting active exchange settlement, had no bounded `refresh` code, returned stale expiry status, and lacked process-isolated independent-field evidence.
- `e969512d90` committed the exact terminal `AuthChanged` payload/redaction contract before the direct terminal-status notification fix.

### Approval Repairs

- Every active callback exchange is tracked by attempt as `{ controller, settled }`. Shared quiescence aborts all matching exchanges first, awaits all settlement promises, CAS-terminalizes any remaining received/exchanging attempt exactly once, and only then closes registrations.
- Remove, reset, stop, config reload, disable, endpoint/scope/redirect replacement, and Location finalization all flow through abort-before-close cleanup. Fresh and recovered handlers now both mark failure and schedule listener cleanup after the HTTP response can settle, avoiding self-close deadlock.
- Proactive refresh redirect fallback throws the typed internal `AuthRequired`; invalid-grant and interaction-required paths become `auth-required`, while unexpected refresh defects become bounded `refresh`. Error bodies, URLs, tokens, and provider messages are never copied into public errors.
- Expiry terminalization rereads the store before precedence selection and treats `expired` as a failed `attempt-expired` result, so the first call is deterministic.
- A successful terminal failure CAS emits one internal safe `{ status: "failed", code }` notification. MCP publishes that as one `MCP.Event.AuthChanged`; duplicate terminal attempts cannot emit, and payloads contain no authorization URL, verifier, state, code, token, client, or provider text.
- Added a real 12-process independent-field update race. All child writes survive one shared store bucket.

### Approval Coverage

- Hanging exchange teardown covers remove, reset, and stop directly. A service-level endpoint replacement proves reload is fenced until that reset settles, composing the same tested active-exchange path. Callback response settles 400, attempts scrub once, and the callback port is immediately reusable.
- A recovered callback exchange failure records bounded `exchange`, schedules registration cleanup, and immediately reuses the port.
- Invalid-grant, malformed response, and interaction fallback return only `auth-required` or `refresh`, create no attempts/listeners, and do not expose private response text.
- First-call expiry returns `{ status: "failed", code: "attempt-expired" }`, emits once, scrubs secrets, and a second status call emits nothing.
- MCP-level event evidence asserts exactly one `mcp.auth.changed` payload containing only server and bounded failed status/code, with no authorization or client material.
- Spawned store workers concurrently add 12 independent attempts with no lost fields.

### Approval Results

- Approval subset: `63 pass`, `0 fail`, `281 expect() calls`, 4 files.
- Final focused 13-file command: `131 pass`, `0 fail`, `539 expect() calls`.
- H5C4A/B1 regression command: `71 pass`, `0 fail`, `257 expect() calls`.
- Full Core: `1419 pass`, `0 fail`, `4335 expect() calls`, 153 files.
- Full CodeMode: `254 pass`, `0 fail`, `744 expect() calls`.
- V1 MCP HTTP/CLI evidence: `8 pass`, `0 fail`, `32 expect() calls`; the prior broader V1 OAuth command remains `40 pass`, `0 fail`, `123 expect() calls`.
- Core typecheck: exit 0.
- Server typecheck: exit 0.
- Frozen install: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- SlopCode typecheck remains red only at the unrelated existing `src/session/processor.ts(495,17)` and `src/session/prompt.ts(1382,39)` diagnostics.

### Approval Commits

- `d916301b77` `test(core): expose MCP OAuth active cleanup gaps`
- `4188e32f15` `fix(core): settle active MCP OAuth work`
- `e969512d90` `test(core): verify terminal MCP auth events`
- `973b351de1` `fix(core): publish exact terminal auth events`
- `98ddea0754` `test(core): name interaction refresh coverage`
- `710a47849c` `test(core): fence OAuth reset during replacement`
- `415c925597` `test(core): preserve delayed cleanup fixture`
- Approval report: the following `docs:` commit.

## Final Four Findings Settlement

### Final Four RED Evidence

- Exact proactive refresh command: `0 pass`, `2 fail`, `2 expect() calls`. Noninteractive `redirectToAuthorization` returned its own generic error instead of the supplied typed redirect error, and the interaction-required refresh case returned `refresh` instead of exact `auth-required`.
- Exchange-event/timer command: `0 pass`, `3 fail`, `7 expect() calls`. Fresh and recovered exchanges were already durably failed by a direct store CAS before notification-aware cleanup ran, so both emitted zero terminal changes. A recovered pending callback remained pending with state/verifier/authorization after its wall-clock expiry.
- Enabled-to-disabled command: `0 pass`, `1 fail`, `10 expect() calls`. An unchanged OAuth identity skipped reset entirely when only `disabled` changed.
- `1d27db73fe` committed these failing exact contracts before the production changes. `6e10fed65b` then tightened exact mappings and added fresh-timer/protocol-event assertions before `bc26926484` completed the implementation.

### Final Four Repairs

- `MCPOAuthProvider.redirectToAuthorization` always delegates to the supplied callback. Noninteractive refresh supplies the typed internal `AuthRequired` callback, so SDK fallback to interaction cannot become a generic provider error.
- Invalid-grant refresh retry, malformed/server refresh fallback, and explicit interaction-required all map exactly to bounded `auth-required` in current SDK behavior. Explicit `interaction_required` OAuth errors are also recognized before public mapping. Noninteraction refresh defects retain bounded `refresh`; no server description/body is exposed.
- Exchange `tapError` now calls the same notification-aware atomic `mark` CAS used by all terminal failures. Fresh, recovered, and manual completion failures emit only when that CAS wins; callback cleanup, timer, status, quiescence, and duplicate retry CAS misses emit nothing.
- Enabled-to-disabled transitions collect both active and staged exact targets regardless of OAuth identity equality. Tools are hidden first, then every target reset is awaited before client cleanup/public disabled status, preserving hide-before-close while aborting pending and active exchanges without deadlock.
- Every fresh initializing attempt receives a scoped wall-clock timer immediately after persistence. Fresh pending attempts retain that timer; recovered pending/manual attempts schedule the remaining persisted duration after listener registration. Timer CAS accepts only initializing/pending, emits one safe expiry event, scrubs transients, and closes the listener.
- Completion, cancellation, failure, remove/reset/stop, replacement, disable, and Location shutdown all close ownership and clear the attempt timer. A timer racing received/exchanging work cannot close its listener because a failed expiry CAS performs no cleanup.

### Final Four Coverage

- Provider evidence proves a noninteractive redirect returns the exact supplied typed error object.
- Refresh evidence expects exact `auth-required` independently for invalid grant, malformed fallback, and `interaction_required`; each case creates zero attempts and exposes no private description.
- Real protocol evidence proves fresh and recovered exchange failure each emit exactly one bounded terminal change, and status/cleanup retries emit none.
- Production MCP integration runs actual resource/auth discovery, loopback callback, failed token exchange, `MCP.locationLayer`, and `EventV2.Service`. It observes one normal authorizing event and exactly one safe terminal `mcp.auth.changed` exchange event with no callback code or authorization URL.
- Disable composition proves same-identity enabled-to-disabled reload invokes OAuth reset and reaches disabled state. Existing pending/hanging reset tests prove callback cancellation, active exchange abort/settlement, and immediate port reuse behind that reset.
- Fresh and restart-recovered pending auto attempts expire without status or callback activity, emit once, erase state/verifier/authorization, close listeners, and immediately release callback ports.

### Final Four Results

- Exact refresh/provider subset: `2 pass`, `0 fail`, `10 expect() calls`.
- Exact protocol/event/timer subset: `4 pass`, `0 fail`, `19 expect() calls`.
- Exact disable subset: `1 pass`, `0 fail`, `13 expect() calls`.
- Final focused 13-file command: `135 pass`, `0 fail`, `559 expect() calls`.
- H5C4A/B1 preservation command: `71 pass`, `0 fail`, `260 expect() calls`.
- Full Core after production event integration: `1423 pass`, `0 fail`, `4356 expect() calls`, 153 files.
- Full CodeMode: `254 pass`, `0 fail`, `744 expect() calls`.
- V1 MCP HTTP/CLI evidence: `8 pass`, `0 fail`, `32 expect() calls`.
- Core typecheck: exit 0.
- Server typecheck: exit 0.
- Frozen install: exit 0, `Checked 2372 installs across 2656 packages (no changes)`.
- SlopCode typecheck remains red only at the unrelated existing `src/session/processor.ts(495,17)` and `src/session/prompt.ts(1382,39)` diagnostics.

### Final Four Commits

- `1d27db73fe` `test(core): expose final MCP OAuth approval gaps`
- `6e10fed65b` `test(core): tighten final MCP OAuth evidence`
- `bc26926484` `fix(core): finalize MCP OAuth terminal lifecycle`
- `18d94420f7` `test(core): integrate real MCP OAuth failure event`
- Final report evidence: the following `docs:` commit.
