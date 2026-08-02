# Task 2: durable remote orchestration journal

## Changed files

- `packages/slopcode/src/server/routes/instance/httpapi/handlers/remote-agent-journal.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/handlers/remote-agent-jobs.ts`
- `packages/slopcode/src/server/routes/instance/httpapi/handlers/remote-runtime.ts`
- `packages/slopcode/test/server/remote-agent-journal.test.ts`
- `packages/slopcode/test/server/httpapi-remote-runtime.test.ts`

## Behavior

- Stores remote job snapshots, backend PTY/session mappings, ordered retained events, expiring request idempotency records, terminal outcomes, pending interactions, artifact metadata, and plan-save tokens in SQLite.
- PTY creation failures are compensated to a durable `failed` snapshot instead of leaving a queued claim; the job-state route exposes that recoverable terminal outcome.
- Uses immediate SQLite transactions for create/duplicate/conflict decisions, event/state updates, interaction in-flight/delivery completion, artifact quotas, and plan-token consumption.
- Rehydrates durable snapshots when the job service is created; a missing in-memory process handle does not mark a remote job failed.
- Replays retained events and emits `job.snapshot_required` with the authoritative durable state when an explicit cursor predates the retained tail; `GET /remote/agent/job/:jobID` returns the same snapshot for HTTP recovery.
- Approval/question actions now require the interaction ID, expected revision, and idempotency key. Delivery is marked in-flight first, and only resolves atomically with the durable state-clearing event after the live write succeeds; an in-flight retry is delivered at least once.
- Artifact metadata and short-lived plan tokens are reachable through typed remote-job HTTP routes.
- Every start, including a live in-memory job, passes through the scoped journal idempotency transaction; live conflicting prompts/configuration now fail cleanly.
- Reused backend interaction IDs advance to a fresh durable revision that is reflected in the emitted event and snapshot before an answer is accepted.
- Durable state, artifacts, plan preparation, and token commit are bound to both routed workspace and instance root; plan tokens are also bound to their original job ID.
- Event streaming and all job actions use the same routed workspace/root guard, so an ID cannot expose retained output or mutate a job across an instance or workspace boundary.
- SQLite query failures are terminated at the journal boundary while domain failures remain typed, so the job service API does not leak database driver errors into HTTP handlers.
- Retains at most 2,048 events per job, bounds persisted event/state/metadata sizes, limits artifacts to 64 per job, expires idempotency records after 24 hours, and uses five-minute single-use plan tokens.
- Keeps prompts and process environments out of the journal. Recovered jobs reject actions that cannot be delivered to an active in-memory process handle.

## Validation

- `bun test test/server/remote-agent-journal.test.ts --timeout 30000` — 9 pass.
- `bun test test/server/httpapi-remote-runtime.test.ts --timeout 30000` — 23 pass, including cross-root and cross-workspace stream/action denial.
- `bun run typecheck` — pass.
- `git diff --check` — pass after the journal transaction/type-boundary correction.

## Limitations

- A service restart restores snapshots and replay state but does not recreate a PTY or resume a process. Recovered jobs remain inspectable; a user starts a fresh job to run again.
