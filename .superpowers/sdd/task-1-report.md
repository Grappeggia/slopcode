# Task 1 implementation report

## Changed files

- `packages/android/src/ssh-connect.tsx`
- `packages/android/src/ssh-connect-state.ts`
- `packages/android/src/ssh-connect-state.test.ts`

## Result

- Reset onboarding credentials, pending host-key verification, setup state, workspace state, and errors on computer, authentication, Change, Add, and cancellation paths.
- Guard saved-credential reads with a revision and current-profile check, preventing a late response from populating a different target or a changed authentication method.
- Bind shell navigation and saved workspace persistence to the active native connection profile and canonical selected directory.

## Verification

- `bun test src/ssh-connect-state.test.ts src/ssh-workspace-state.test.ts` — 5 pass.
- `bun run typecheck` — pass.
- `bun run build` — pass (web and Android debug APK).
- `bun test src` was also run while other in-flight task changes were present; one unrelated source-regression assertion failed before its concurrent update landed. No live SSH fixture credentials were available, so live SSH was not claimed.

## Commit

`5a9c4f1ea263c2f0160b9d3644983b4823c0040e` (`fix(android): reset SSH onboarding state safely`).

## Blockers

No implementation blocker. Live SSH validation remains unavailable without the protected emulator fixture credentials.
