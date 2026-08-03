# Task 4B — Android rendered-UI E2E baseline

## Changed files

- `packages/android/app/build.gradle.kts`
  - Added the minimal `androidx.test:core` instrumentation dependency for `ActivityScenario`.
- `packages/android/app/src/androidTest/java/dev/slopcode/android/AndroidUiInstrumentedTest.kt`
  - Launches the packaged `MainActivity` and interrogates the actual rendered WebView DOM.
  - Seeds only non-secret saved-workspace metadata through the same encrypted storage namespace used by the app.
  - Exercises saved-computer and Add-computer presentation, semantic menu controls, 48 CSS-pixel touch regions, hidden-file default-off and reveal behavior, remote folder selection, all five agent cards/statuses, the missing-agent setup checklist, and dark-theme rendering.
  - Uses a document-start, test-only message bridge for deterministic connected/SFTP/agent states. It never calls SSH, reads credentials, or modifies the production transport/harness.

## Validation

- `bun run build:web` — passed.
- `./gradlew :app:compileDebugAndroidTestKotlin` — passed.
- `./gradlew :app:assembleDebug :app:assembleDebugAndroidTest` — passed.
- Direct installed-APK run through `adb shell am instrument ... AndroidUiInstrumentedTest`
  - The saved-computer/Add-computer test passes against the real packaged `MainActivity`/WebView.
  - The mocked transport flow reached the rendered SFTP folder browser with a 48px `Use this folder` control. Its final rerun was interrupted when a concurrent `adb shell monkey -p dev.slopcode.android 1` force-stopped the target process; it must be rerun on a reserved emulator to record the complete two-test pass.
- `bun run typecheck` is currently blocked by an unrelated concurrent change in `src/ssh-workspace-state.test.ts` (inferred literal `agent` type mismatch), not by this test entrypoint.

## Contract dependency

No missing-session deep-link assertion is added yet. The current SSH renderer receives remote-session links but has no explicit “session unavailable or expired” UI/recovery contract; Task 3 owns that behavior. Once Task 3 lands, add a deterministic intent launch assertion that verifies the exact recovery message and its action.

## Blockers

- No protected SSH fixture credentials were used or required, so this work makes no live-SSH success claim.
- The connected emulator must be reserved from parallel install/uninstall/`monkey` runs for the final complete instrumentation pass.
