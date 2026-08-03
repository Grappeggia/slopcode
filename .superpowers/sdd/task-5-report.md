# Task 5 notification scope report

## Delivered

- Added notification permission unit coverage for Android 13 grant, deny, first-prompt, upgrade-from-disabled, and pre-Android-13 enablement behavior.
- Added notification-only action policy: approval, question, stop, retry, and terminal/revoked jobs have an explicit allowed action set. A question notification opens its exact job/session instead of sending an empty answer.
- Hardened notification taps in `RemoteJobService`: duplicate concurrent taps are coalesced, stale terminal/revoked actions are ignored before network work, and stop/retry/accepted-action notifications refresh immediately.
- Added `bun scripts/validate-android-audit.ts`, a repeatable emulator runner that rebuilds/installs the debug APK, captures portrait/landscape plus light/dark screenshots, restores device settings, writes bounded/redacted logs, runs notification unit and deep-link instrumentation checks, and reports live SSH as passed, failed, or unavailable.

## Validation

- `bun test src/remote-jobs.test.ts src/remote-job-notification.test.ts src/remote-session-recovery.test.ts src/platform.test.ts src/bridge.test.ts` — 23 passed before Task 3 ownership was handed off. Task 3-owned TypeScript additions were then removed from this change set.
- `bun run typecheck` — passed before the ownership handoff; no TypeScript files remain in this scoped commit.
- `./gradlew :app:testDebugUnitTest --tests dev.slopcode.android.NotificationPermissionTest --tests dev.slopcode.android.RemoteJobNotificationTest` — passed.
- `bun build scripts/validate-android-audit.ts --target bun --outdir /tmp/slopcode-android-audit-parse` — passed.
- `./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=dev.slopcode.android.SshTransportInstrumentedTest#deepLinkIntentResolvesToMainActivity` — passed on `emulator-5554` before the ownership handoff.

## Unavailable or blocked checks

- Live SSH harness: `./scripts/run-ssh-e2e-all-agents.sh` exited 2 as designed because `SSH_HOST` is not configured. No SSH credentials or backend runs were attempted, and this report does not claim live SSH coverage.
- Release APK: `:app:assembleRelease` is blocked by an existing Gradle validation error: `:app:generateReleaseLintVitalReportModel` reads `app/build/generated/assets/site` from `:app:syncWebAssets` without a declared dependency. The build configuration is outside this notification-only scope.
- The screenshot runner was compiled but not rerun after the ownership handoff, to avoid altering the shared emulator while Task 3 is active. Run `bun scripts/validate-android-audit.ts` from `packages/android` on a reserved emulator; set `ANDROID_AUDIT_RUN_LIVE_SSH=1` only with the required protected SSH environment.

## Ownership handoff

At the user’s direction, Task 3 owns `remote-jobs.ts`, remote-job tests, lifecycle, replay, and deep-link work. No Task 5 changes to those files remain in this commit.
