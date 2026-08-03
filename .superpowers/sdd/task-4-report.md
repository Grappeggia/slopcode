# Task 4 — Android SSH/E2E harness review fixes

## Delivered

- Credential-gated connected-test runner. SSH key and password files stream directly through `adb shell run-as` into app-private storage with `umask 077`; no shell-owned staging path, Gradle secret arguments, or secret logging.
- Remote fixture scope is fixed to `/home/agent/temp`. SFTP coverage requires the known hidden sentinel, verifies hidden entries are absent by default and visible with `showHidden=true`, validates paths, and exercises the persisted three-entry recent-folder model.
- Coverage includes all five allowlisted agents, key/password authentication, host-key trust and mismatch, preflight/setup/login, PTY input/resize/Ctrl-C, disconnect/reconnect, process death, and an active-PTY network-loss/reconnect/resume scenario.
- The deep-link smoke uses Android PackageManager resolution and matching-activity assertions for the exact session URI. Connected-test XML is checked for the requested method and zero failures/errors/skips.
- Live network-loss execution is mandatory: the script requires `SSH_E2E_NETWORK_LOSS=1`, and the test fails if the network-loss argument is absent.

## Validation

- `bun test src` — 100 passing tests.
- `bun run typecheck` — passing.
- `bun run build` — passing.
- `:app:compileDebugAndroidTestKotlin`, debug APK, Android test APK, and focused Kotlin unit tests — passing.
- Connected emulator PackageManager deep-link test — passing through `:app:connectedDebugAndroidTest`.
- Missing live-fixture configuration — fails clearly; no live SSH result is claimed without protected credentials and fixture setup.

## Live fixture requirement

Run `packages/android/scripts/run-ssh-e2e-all-agents.sh` with the required protected SSH host/user, private-key file, password file, setup-agent choice, install acknowledgment, and `SSH_E2E_NETWORK_LOSS=1`. The remote fixture must contain `.slopcode-android-e2e-sentinel` under `/home/agent/temp`.
