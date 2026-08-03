# Task 1 implementation report

## Changed files

- `packages/android/src/ssh-connect.tsx`
- `packages/android/src/ssh-connect-state.ts`
- `packages/android/src/ssh-connect-state.test.ts`

## Result

- Reset onboarding credentials, pending host-key verification, setup state, workspace state, and errors on computer, authentication, Change, Add, and cancellation paths.
- Guard saved-credential reads with a revision and current-profile check, preventing a late response from populating a different target or a changed authentication method.
- Bind shell navigation and saved workspace persistence to the active native connection profile and canonical selected directory.
- Follow-up review fixes: manual password, passphrase, and key selection now invalidate saved-credential reads even for the same profile; a monotonic onboarding generation fences host trust, SFTP, agent checks, preflight, setup, persistence continuation, and disconnect completions.

## Verification

- `bun test src/ssh-connect-state.test.ts src/ssh-workspace-state.test.ts` — 7 pass.
- `bun run typecheck` — pass.
- `bun run build` — pass (web and Android debug APK).
- `bun test src` — 95 pass.

## Commit

`5a9c4f1ea263c2f0160b9d3644983b4823c0040e` (`fix(android): reset SSH onboarding state safely`).

Follow-up race-fix commit: pending.

## Blockers

No implementation blocker. Live SSH validation remains unavailable without the protected emulator fixture credentials.
