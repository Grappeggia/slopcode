# Task 1 Report: app shell and routing parity

## Status

DONE_WITH_CONCERNS

## Implemented parity slice

- Added canonical server-keyed session route helpers and the `/server/:serverKey/session/:id` route. It validates the encoded server key, resolves the session against that server, selects it, and safely redirects into the fork's existing directory-keyed session shell.
- Hardened persisted tab migration, including legacy tab entries that lack a server key.
- Added persistent closed-session tab history, background-tab-safe close behavior, and `mod+shift+t` reopen support. Archived/removed sessions and removed servers are pruned from the closed-tab history.
- Preserved the existing SlopCode shell, `@slopcode-ai` imports, provider behavior, Free/Go model handling, Zen endpoints, and the current v2/legacy layout selection and migration logic.

## Tests

Run from `packages/app`:

```sh
bun test --preload ./happydom.ts ./src/utils/session-route.test.ts ./src/context/tabs.test.ts
bun run typecheck
```

Result: 9 focused tests passed; app typecheck passed.

## Self-review

- Verified invalid or stale server-route resolution returns to home without allowing a stale request to override newer navigation.
- Verified closing a background tab does not navigate, while a closed active session selects the adjacent tab or home.
- Verified reopened tabs preserve their prior index when possible and do not duplicate an already-open session.
- `git diff --check -- packages/app` passed.

## Concerns / remaining gap

This intentionally does not wholesale adopt the reference's incompatible new persistent shell, direct target-session content renderer, or full selected-server provider remount architecture. Server-keyed deep links resolve through the existing directory-keyed shell after fetching the target session, and existing v2/legacy home/layout selection remains in place. A later parity task can introduce the reference shell only after its missing dependent components are adapted to the SlopCode fork.
