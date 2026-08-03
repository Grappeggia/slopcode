# Task 2 follow-up report — Android shell layout review

## Findings fixed

- Landscape WebView safe-area variables were not reliable. `MainActivity` now records `WindowInsetsCompat` system-bar, cutout, and IME insets, exposes them through the origin-restricted Android bridge, and `SshShell` converts native pixels to CSS pixels on mount, rotation, viewport resize, and keyboard resize. Shell CSS consumes root-level inset variables, with a conservative 32px landscape hamburger floor.
- Landscape onboarding `Continue` no longer uses sticky positioning. It remains in normal flow so it cannot cover `Add computer`, while the scroll container still makes the action reachable at the bottom.
- `SshSession` now renders inside `SshShell`, so interactive PTY controls share the drawer, theme tokens, safe-area behavior, and native system-bar appearance with onboarding and agentic sessions.
- Shell buttons, PTY inputs, approval/retry/stop controls, question answers, summaries, diagnostics, and text fields receive a 48px minimum touch height. Existing labels, live regions, and interaction semantics were preserved.
- The visual matrix no longer reads CSS/source strings as its primary assertion. It now audits deterministic rendered rectangles, minimum touch targets, and the two historical landscape overlaps. A CDP-based emulator checker asserts the actual WebView geometry and writes a landscape evidence screenshot.

## Changed files

- `packages/android/app/src/main/java/dev/slopcode/android/MainActivity.kt`
- `packages/android/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`
- `packages/android/src/bridge.ts`
- `packages/android/src/ssh-shell.css`
- `packages/android/src/ssh-shell.tsx`
- `packages/android/src/ssh-session.tsx`
- `packages/android/src/ssh-shell-visual.ts`
- `packages/android/src/ssh-shell-visual.test.ts`
- `packages/android/scripts/verify-ssh-shell-emulator.ts`

## Validation

- `bun test` from `packages/android`: 99 passed; 1 unrelated source-regression assertion fails because another worker's live SSH harness no longer contains the expected `Process crashed` marker. No other worker file was changed to mask that failure.
- `bun test src/ssh-shell-visual.test.ts src/ssh-session-flow.test.ts src/bridge.test.ts`: 18 passed, 52 assertions.
- `bun run typecheck`: passed.
- `bun run build:web`: passed; existing Vite chunk-size and duplicate-map warnings remain.
- `./gradlew :app:compileDebugKotlin`: passed.
- `./gradlew :app:assembleDebug`: passed.
- Installed the final debug APK on `emulator-5554` and ran `bun scripts/verify-ssh-shell-emulator.ts` from `packages/android`.
- Emulator assertion: landscape viewport `915×412`, native top/bottom insets `24px`, hamburger `top=36px` and `48×48`, Add/Continue separated by `16px` before and after scrolling, primary action in normal flow, and all rendered controls at least `48px` high.
- Evidence screenshot: `/tmp/slopcode-task2-landscape-layout.png`.

## Commit

Follow-up commit: pending.
