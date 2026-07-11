# Task H5A2 Report

## Status

Complete. V2 agent switching and slash-style skill admission now use the Session's location-owned catalogs, durable events/input, and runtime ownership fencing without V1 adapters.

## Commit

- `feat(session): add V2 agent and skill admission` (this commit)
- Nothing was pushed.

## Evidence

RED:

- Focused switch and skill tests initially failed with `Session.OperationUnavailableError` from both unfinished stubs.
- The first location-owned implementation exposed missing `LocationServiceMap` providers in legacy Core test graphs.
- Providing a second location map inside `SessionV2.defaultLayer` caused a circular initialization error; the final graph requires callers to provide the shared application map instead.

GREEN:

- Focused H5A2 agent, skill, recovery, and control tests: `14 pass`, `0 fail`.
- Focused runner context-replacement and concurrent-preparation tests: `4 pass`, `0 fail`.
- Native public embedding tests: `6 pass`, `0 fail`.
- Isolated EventV2 retry after transient database contention: `46 pass`, `0 fail`.
- Final full Core suite: `1181 pass`, `0 fail`.
- Core typecheck: passed.
- Server typecheck: passed.
- `git diff --check`: passed.

## Changes

- Added typed `Session.AgentUnavailableError` and `Session.SkillNotFoundError` values with requested and available catalog entries.
- Implemented selectable-agent validation, no-op repeats, durable `AgentSwitched` publication, projection, and context replacement through the existing runner behavior.
- Resolved agents and skills only through the stored Session Location and waited for plugin boot before lookup.
- Changed skill IDs to `SessionMessage.ID` and admitted raw skill content through the existing prompt lifecycle, idempotency, conflict, resume, wake, and recovery paths.
- Extended `SessionControl` with skill and optional epoch fencing; guarded mutations recheck the captured V2 epoch after catalog boot.
- Exposed the same validated agent and skill methods through the native public embedding API.
- Kept shell and compact unavailable; no HTTP, SDK, TUI, V1, subagent, MCP, plugin, or compact implementation was added.

## Files

- `packages/core/src/session.ts`
- `packages/core/src/session/control.ts`
- `packages/core/src/public/session.ts`
- `packages/core/src/public/slopcode.ts`
- `packages/core/test/session-agent-skill.test.ts`
- `packages/core/test/session-runner.test.ts`
- `packages/core/test/public-slopcode.test.ts`
- `packages/core/test/session-create.test.ts`
- `packages/core/test/session-prompt.test.ts`
- `packages/core/test/session-projector.test.ts`
- `packages/core/test/session-runner-recorded.test.ts`
- `packages/core/test/move-session.test.ts`
- `packages/core/test/permission.test.ts`
- `packages/core/test/lib/location-services.ts`
- `.superpowers/sdd/task-h5a2-report.md`

## Self-Review

- Unknown, hidden, and subagent selections fail before event publication; repeated selected-agent requests publish nothing.
- Skill lookup consumes `SkillV2.list()`, preserving its later-source precedence, and never manufactures a tool call or permission request.
- SessionControl validates V2 ownership before lookup and rechecks the captured epoch immediately before switch publication or skill prompt admission.
- Runner tests invoke the validated switch API during context observation and provider preparation, confirming one execution loop and rebuilt context.
- Public embedding methods delegate to the same Session implementation and therefore return the same typed validation failures.

## Concerns

- One full-suite attempt run alongside server typecheck hit the repository's shared default SQLite database with `SQLITE_BUSY`; the isolated EventV2 suite and a subsequent standalone full Core run both passed. No product or test code was changed for that unrelated contention.
