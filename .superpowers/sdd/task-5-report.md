# Task 5 notification review fixes

## Delivered

- `job.revoked` and `job.expired` now persist as terminal states. Unknown events preserve the current state, so they cannot reopen approval, question, stop, or retry actions.
- Notification interactions are serialized per job state/interaction. Contradictory approval taps cannot both reach the action endpoint; each action request has a stable interaction-scoped `Idempotency-Key`.
- A failed stop request leaves the remote job active and records `actionError` plus `retryAction=stop`; the notification tells the user to retry instead of claiming the job stopped.
- Duplicate URI delivery from Intent data plus `notification_href` is coalesced while retaining the exact job and session. The bridge queue also remains deduplicated across deferred renderer delivery.
- FCM payloads are bounded and covered as wake metadata only. They never persist or advance the SSE replay cursor before the stream consumes the event.
- The Android audit runner records individual permission, action, terminal-event, exact-session, duplicate-link, replay/wake, FCM-payload, activity, screenshot, FCM-transport, and SSH results. It writes failures for interrupted checks rather than `not run`.
- `:app:assembleRelease` now declares `syncWebAssets` for the release lint tasks that read generated web assets. No publishing or release workflow was changed.

## Validation

- `./gradlew :app:testDebugUnitTest --tests dev.slopcode.android.NotificationPermissionTest --tests dev.slopcode.android.RemoteJobModelsTest --tests dev.slopcode.android.RemoteJobNotificationTest --tests dev.slopcode.android.RemoteJobHttpTest --tests dev.slopcode.android.RemoteJobPushTest --tests dev.slopcode.android.DeepLinkDeliveryTest` — passed.
- `bun run typecheck` — passed.
- `bun test src/remote-jobs.test.ts src/remote-job-notification.test.ts src/remote-session-recovery.test.ts src/platform.test.ts src/bridge.test.ts` — 21 passed, 0 failed.
- `bun run build` — passed.
- `bun build scripts/validate-android-audit.ts --target bun --outdir /tmp/slopcode-android-audit-parse` — passed.
- `./gradlew :app:assembleRelease` — passed, including `generateReleaseLintVitalReportModel`, `lintVitalAnalyzeRelease`, `lintVitalReportRelease`, and `lintVitalRelease`.
- `ANDROID_AUDIT_BUILD=0 ANDROID_AUDIT_REPORT_DIR=/tmp/slopcode-android-audit-task5-rerun bun run ./scripts/validate-android-audit.ts` — passed all runnable checks on `emulator-5554`: notification permission/actions, revoked/expired handling, exact-session/pending link, duplicate delivery, cursor replay/wake, FCM payload wake, activity resolution, and four orientation/theme screenshots. The existing APK was used because the preceding full `bun run build` had already passed.

## External limitations

- Firebase transport delivery is unavailable in this checkout: no registered Firebase project/device token or protected sender credentials are configured. Native FCM payload parsing and wake metadata are tested; no payload advances the persisted SSE cursor.
- Live SSH is unavailable: `SSH_HOST`, `SSH_USER`, `SSH_KEY_FILE`, `SSH_PASSWORD_FILE`, `SSH_E2E_SETUP_AGENT`, `SSH_E2E_ALLOW_INSTALL`, `SSH_E2E_CONFIRM`, and `SSH_E2E_NETWORK_LOSS` are absent. No credentials were used and this report makes no live SSH claim.
