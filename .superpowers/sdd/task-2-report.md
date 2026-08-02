# Task 2: durable remote orchestration journal

## Changed files

- `packages/slopcode/src/server/routes/instance/httpapi/handlers/remote-agent-journal.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/handlers/remote-agent-jobs.ts`
- `packages/slopcode/test/server/remote-agent-journal.test.ts`

## Behavior

- Stores remote job snapshots, backend PTY/session mappings, ordered retained events, request fingerprints/idempotency records, terminal outcomes, pending interactions, artifact metadata, and plan-save tokens in SQLite.
- Uses immediate SQLite transactions for create/duplicate/conflict decisions, event/state updates, interaction replies, artifact quotas, and plan-token consumption.
- Rehydrates durable snapshots when the job service is created; a missing in-memory process handle does not mark a remote job failed.
- Replays retained events and emits `job.snapshot_required` when an explicit cursor predates the retained tail.
- Retains at most 2,048 events per job, bounds persisted event/state/metadata sizes, limits artifacts to 64 per job, expires idempotency records after 24 hours, and uses five-minute single-use plan tokens.
- Keeps prompts and process environments out of the journal. Recovered jobs reject actions that cannot be delivered to an active in-memory process handle.

## Validation

- `bun test test/server/remote-agent-journal.test.ts --timeout 30000` — 5 pass.
- `bun test test/server/httpapi-remote-runtime.test.ts --timeout 30000` — 22 pass.
- `bun run typecheck` — pass.

## Limitations

- This task deliberately preserves the existing public HTTP schemas, so expected interaction revisions and idempotency keys are journal capabilities rather than new HTTP request fields.
- A service restart restores snapshots and replay state but does not recreate a PTY or resume a process; retry needs the original in-memory prompt and remains unavailable for a recovered job.
