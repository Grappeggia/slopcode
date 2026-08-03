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
- Cleanup follow-up: stale connect/home completions serialize a profile-checked native disconnect that cannot affect a newer attempt; intentional disconnect clears its captured local connection identity even if an unrelated transition advanced onboarding state.
- Leave follow-up: local connected/profile/workspace state is reset synchronously before awaiting native disconnect, so a late folder result cannot leave the UI claiming an unavailable transport.

## Verification

- `bun test src/ssh-connect-state.test.ts src/ssh-workspace-state.test.ts` — 12 pass.
- `bun run typecheck` — pass.
- `bun run build` — pass (web and Android debug APK).
- `bun test src` — 100 pass.

## Commit

`5a9c4f1ea263c2f0160b9d3644983b4823c0040e` (`fix(android): reset SSH onboarding state safely`).

Follow-up race-fix commit: `9bb2c7599142c4ac1548902c4e2f70e68b1bc320` (`test(android): gate live SSH E2E fixture`; shared-index commit containing the reviewed Task 1 race fix).

Cleanup follow-up commit: `b8011da164507fb6c885d9d6f31675e91952f019` (`fix(android): clean stale SSH connections safely`).

Leave follow-up commit: pending.

## Blockers

No implementation blocker. Live SSH validation remains unavailable without the protected emulator fixture credentials.
