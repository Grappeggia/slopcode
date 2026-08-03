# Task 1 report: durable agent-orchestration protocol

## Status

DONE

## Implementation

- Added `packages/protocol/src/agent-orchestration.ts`, a strict Effect Schema v1 contract for Android/remote-bridge orchestration.
- Defined the fixed agent IDs `slopcode`, `opencode`, `codex`, and `claude`, capability negotiation, workspace/session/turn requests, approval and question interactions, plan save prepare/commit requests, artifacts, replay requests/responses, structured events, and stable errors.
- All fixed-shape payloads reject excess properties. Inputs are byte-bounded, arrays have explicit limits, paths are canonical absolute POSIX paths, and metadata rejects secret-shaped and prototype keys.
- Replay responses enforce distinct cursors and strictly increasing event sequences. Interaction replies include revisions and expose a helper for stale-revision checks.
- Exported the contract from the protocol package root.

## Files

- `packages/protocol/src/agent-orchestration.ts`
- `packages/protocol/src/index.ts`
- `packages/protocol/test/agent-orchestration.test.ts`
- `packages/protocol/test/public-root.test.ts`

## Tests

Run from `packages/protocol`:

- `bun test test/agent-orchestration.test.ts test/public-root.test.ts` — 6 pass, 0 fail, 27 assertions.
- `bun test` — 34 pass, 0 fail, 170 assertions.
- `bun run typecheck` — passed (`tsgo --noEmit`).
- `git diff --check` — passed.

## Self-review

- Verified source is ASCII text with escaped control-character ranges; no literal control bytes remain.
- Verified frame and JSON-frame byte limits, nested exact decoding, metadata filtering, and complete replay-frame sizing.
- Verified the commit scope excludes all existing Android SSH work and this report.

## Concerns

None.

## Review fix

- Replaced opaque event cursors with bounded numeric `cur_<position>` cursors, capped at a signed 32-bit position.
- Replay responses now require event cursors to increase with event sequence, require `nextCursor` to advance beyond the final returned cursor, and require `hasMore` to exactly match continuation presence.
- Added regressions for an earlier/malformed/missing continuation, metadata entry/value/aggregate limits, byte-bounded paths, and negative/oversized artifact sizes.

### Review-fix validation

Run from `packages/protocol`:

- `bun test test/agent-orchestration.test.ts test/public-root.test.ts` — 7 pass, 0 fail, 37 assertions.
- `bun test` — 35 pass, 0 fail, 180 assertions.
- `bun run typecheck` — passed (`tsgo --noEmit`).
- `git diff --check` — passed.
