# V2 Session Runtime Cutover

This spec defines the first migration invariant for making the V2 session runner the sole durable agent runtime while preserving V1 sessions and legacy clients.

## Runtime Ownership

Every session has a persisted runtime owner:

- `v1`: the legacy `SessionPrompt` loop is authoritative.
- `v2`: the core V2 `SessionRunner` is authoritative.

Ownership is stored on the `session` row with:

- `runtime`: current owner, default `v1` for existing and newly projected legacy sessions.
- `runtime_epoch`: monotonic fencing epoch, default `0`.
- `runtime_state`: migration/control state, default `ready`.

Valid states are:

- `ready`: the current owner may accept work.
- `draining`: new work should queue or fail retryably while in-flight work settles.
- `migrating`: history/projections are being converted and verified.
- `paused`: execution is blocked until an operator or recovery path resolves the session.

Runtime assignment is durable and session-local. Feature flags may choose the owner for new sessions or migration cohorts, but they must not dynamically reroute an existing session.

## Fencing Rules

Before an execution engine starts a provider turn, tool dispatch, compaction turn, or context-changing operation, it must assert the expected `runtime` and `runtime_epoch`.

If the row has a different owner or epoch, the work is stale and must stop without publishing more assistant output or tool results.

Any ownership or state transition increments `runtime_epoch`. This gives interrupts, migration, rollback, and future leases one shared stale-work fence.

## Migration Strategy

V1 sessions remain executable until migrated. A migration must be resumable and idempotent:

1. Set the session state to `draining` with an expected owner/epoch check.
2. Wait for V1 execution to become idle.
3. Convert legacy `message` and `part` rows into V2 session messages/events without deleting the source rows.
4. Verify IDs, ordering, parent links, tool states, timestamps, summaries, usage, snapshots, and patches.
5. Set state to `migrating` while final checks run.
6. Switch owner to `v2`, incrementing the epoch.
7. Return state to `ready` and admit any queued prompt through V2.

Failed verification leaves the owner as `v1`. A failed post-cutover session remains `v2` and may be paused; it must not silently fall back to V1.

## Compatibility Projections

While legacy clients exist, V2-owned sessions must project V2 history back into legacy `message` and `part` rows. Compatibility projection is a read/client concern, not a second execution path.

The projection must be deterministic and idempotent. Replaying the same V2 events must produce the same legacy rows. Projection code must not publish new V1 execution events that can loop back into V2 projection.

## Initial Durability Scope

The first production cutover targets single-node restart recovery:

- Pending durable inputs are recovered on startup.
- Incomplete provider turns settle to interrupted or retryable states according to the retry policy.
- Completed tool calls are not repeated.
- Uncertain side-effecting tool outcomes become explicit unknown states.

Distributed multi-node leases, remote workers, and OS-level sandboxing are follow-up work. The epoch fence introduced here is still required for those later phases.

## Cutover Gates

V2 may become the default owner only when:

- Existing V1 sessions can migrate and continue under V2.
- Legacy and native clients both read core-owned sessions correctly.
- No supported operation returns `OperationUnavailableError` through stable public APIs.
- Status, wait, interrupt, retry, compaction, permissions, questions, and structured output have V2 implementations.
- MCP, plugin tools, foreground tasks, snapshots, revert, formatting, and LSP diagnostics have parity or explicit deprecation.
- Tests prove no dual execution and no accepted stale-epoch output.
