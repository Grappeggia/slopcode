# Task 1 Report: shared remote protocol contracts

## Status

DONE

## Scope completed

- Added a new top-level protocol module at `packages/protocol/src/remote.ts`.
- Defined versioned runtime-validated remote schemas for:
  - version and mode
  - device and host
  - SSH profile
  - local and SSH workspace variants
  - capability and pairing
  - acknowledgement
  - request, response, event, and error envelopes
- Included the required transport fields:
  - request IDs
  - event cursors
  - idempotency keys
  - acknowledgements
  - explicit `remoteDirectory` for SSH workspaces
- Exported the contracts through `@slopcode-ai/protocol` as a first-class top-level module via `src/remote.ts`.
- Added focused Bun tests in `packages/protocol/test/remote.test.ts` covering valid inputs, invalid inputs, and JSON string round trips.

## Schema notes

- The transport version is fixed to `"v1"`.
- Workspace contracts are a discriminated union:
  - `mode: "local"` requires `directory`
  - `mode: "ssh"` requires `directory`, `remoteDirectory`, and `ssh`
- Envelope payloads remain schema-validated at the envelope layer while keeping `data` open for later task-specific payload contracts.
- JSON helpers were added for both workspaces and envelopes using `Schema.fromJsonString(...)`.

## Files changed

- `packages/protocol/src/remote.ts`
- `packages/protocol/test/remote.test.ts`
- `.superpowers/sdd/task-1-report.md`

## Validation

Run from `packages/protocol`:

```sh
bun test
bun run typecheck
```

Result:

- `bun test`: 6 pass, 0 fail
- `bun run typecheck`: passed

## Concerns

- The envelope `data` fields intentionally stay generic in this task. Concrete per-message payload schemas can layer on top of these contracts in later tasks without changing the transport envelope shape.
