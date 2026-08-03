#!/usr/bin/env bash
set -euo pipefail

package=dev.slopcode.android
test_class=dev.slopcode.android.SshTransportInstrumentedTest
remote_root=/home/agent/temp
adb_bin=${ADB:-adb}
serial=${ANDROID_SERIAL:-}
key_name=id
password_name=password

require() {
  local name=$1
  if [[ -z "${!name:-}" ]]; then
    echo "Live SSH E2E requires $name. The harness will not substitute a default or skip this check." >&2
    exit 2
  fi
}

require SSH_HOST
require SSH_USER
require SSH_KEY_FILE
require SSH_PASSWORD_FILE
require SSH_E2E_SETUP_AGENT
require SSH_E2E_ALLOW_INSTALL
require SSH_E2E_CONFIRM

if [[ "$SSH_E2E_CONFIRM" != "live-ssh" ]]; then
  echo "Set SSH_E2E_CONFIRM=live-ssh to acknowledge real remote CLI activity." >&2
  exit 2
fi

if [[ "$SSH_E2E_ALLOW_INSTALL" != "1" ]]; then
  echo "Set SSH_E2E_ALLOW_INSTALL=1 because this release-candidate harness tests the selected CLI installer." >&2
  exit 2
fi

if [[ ! -f "$SSH_KEY_FILE" || ! -r "$SSH_KEY_FILE" ]]; then
  echo "SSH_KEY_FILE must name a readable private-key file. Its contents are never printed or passed as a Gradle argument." >&2
  exit 2
fi

if [[ ! -f "$SSH_PASSWORD_FILE" || ! -r "$SSH_PASSWORD_FILE" ]]; then
  echo "SSH_PASSWORD_FILE must name a readable password file. Its contents are never printed or passed as a Gradle argument." >&2
  exit 2
fi

case "$SSH_E2E_SETUP_AGENT" in
  slopcode-cli|codex-cli|opencode-cli|claude-code|antigravity-cli) ;;
  *)
    echo "SSH_E2E_SETUP_AGENT must be one of: slopcode-cli, codex-cli, opencode-cli, claude-code, antigravity-cli." >&2
    exit 2
    ;;
esac

port=${SSH_PORT:-22}
if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ ]] || (( port > 65535 )); then
  echo "SSH_PORT must be an integer from 1 through 65535." >&2
  exit 2
fi

if [[ "${SSH_DIRECTORY:-$remote_root}" != "$remote_root" ]]; then
  echo "SSH_DIRECTORY must be $remote_root. Release-candidate artifacts are deliberately scoped to that fixture folder." >&2
  exit 2
fi

if [[ -n "$serial" ]]; then
  adb_args=(-s "$serial")
else
  adb_args=()
fi

adb() {
  "$adb_bin" "${adb_args[@]}" "$@"
}

if ! command -v "$adb_bin" >/dev/null 2>&1; then
  echo "adb is required to run the connected emulator harness." >&2
  exit 2
fi

if [[ "$(adb get-state 2>/dev/null || true)" != "device" ]]; then
  echo "No ready Android emulator/device was found. Set ANDROID_SERIAL when more than one device is connected." >&2
  exit 2
fi

cleanup() {
  adb shell run-as "$package" rm -rf "files/ssh-e2e" >/dev/null 2>&1 || true
  adb shell rm -f "/data/local/tmp/slopcode-ssh-e2e-$key_name" "/data/local/tmp/slopcode-ssh-e2e-$password_name" >/dev/null 2>&1 || true
  if [[ "${network_disabled:-false}" == true ]]; then
    adb shell svc data enable >/dev/null 2>&1 || true
    adb shell svc wifi enable >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run() {
  local method=$1
  local output
  shift
  output=$(mktemp)
  echo "Running $method"
  if ! adb shell am instrument -w -r \
    -e class "$test_class#$method" \
    -e sshE2E true \
    -e sshHost "$SSH_HOST" \
    -e sshPort "$port" \
    -e sshUser "$SSH_USER" \
    -e sshDirectory "$remote_root" \
    -e sshPrivateKeyFile "$key_name" \
    -e sshPasswordFile "$password_name" \
    -e sshSetupAgent "$SSH_E2E_SETUP_AGENT" \
    -e sshAllowInstall true \
    "$@" \
    "$package.test/androidx.test.runner.AndroidJUnitRunner" >"$output" 2>&1; then
    sed -n '1,240p' "$output" >&2
    rm -f "$output"
    return 1
  fi
  if ! rg -q '^INSTRUMENTATION_CODE: 0$' "$output" || rg -q 'FAILURES!!!|INSTRUMENTATION_FAILED' "$output"; then
    sed -n '1,240p' "$output" >&2
    rm -f "$output"
    echo "Android instrumentation did not report a successful test result for $method." >&2
    return 1
  fi
  sed -n '1,160p' "$output"
  rm -f "$output"
}

echo "Building Android app and test APKs locally. Protected SSH data is not included in the build."
bun run build:web
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest

app_apk=app/build/outputs/apk/debug/app-debug.apk
test_apk=app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
if [[ ! -f "$app_apk" || ! -f "$test_apk" ]]; then
  echo "Android APK build outputs are missing; refusing to run a partial harness." >&2
  exit 1
fi

adb install -r "$app_apk" >/dev/null
adb install -r -t "$test_apk" >/dev/null
adb shell pm clear "$package" >/dev/null
adb push "$SSH_KEY_FILE" "/data/local/tmp/slopcode-ssh-e2e-$key_name" >/dev/null
adb push "$SSH_PASSWORD_FILE" "/data/local/tmp/slopcode-ssh-e2e-$password_name" >/dev/null
adb shell run-as "$package" mkdir -p "files/ssh-e2e"
adb shell run-as "$package" cp "/data/local/tmp/slopcode-ssh-e2e-$key_name" "files/ssh-e2e/$key_name"
adb shell run-as "$package" cp "/data/local/tmp/slopcode-ssh-e2e-$password_name" "files/ssh-e2e/$password_name"
adb shell run-as "$package" chmod 600 "files/ssh-e2e/$key_name" "files/ssh-e2e/$password_name"
adb shell rm -f "/data/local/tmp/slopcode-ssh-e2e-$key_name" "/data/local/tmp/slopcode-ssh-e2e-$password_name"

echo "Running real native SSH transport coverage against $SSH_HOST:$port. Remote artifacts are limited to $remote_root."
run firstUseRequiresTrustAndBothSupportedAuthenticationMethodsWork
run sftpListsScopedWorkspaceWithBreadcrumbDataAndHidesDotfilesByDefault
run configuredMissingAgentUsesTheAllowlistedInstallChecklist
run allFiveAgentsPassPreflightSkipLoginAndCompleteOneShotPrompts
run interactivePtyAcceptsInputResizeCtrlCDisconnectAndReconnect
run changedHostKeyIsRejectedWithoutAcceptingTheReplacement
run wrongPasswordIsActionable
run configuredHostPersistsCredentialsBeforeProcessDeath

echo "Force-stopping the app before reconnecting with Keystore-backed credentials."
adb shell am force-stop "$package"
run storedCredentialsReconnectAfterProcessDeath

echo "Launching the exact-session notification deep-link smoke path after process restart."
adb shell am start -W -n "$package/.MainActivity" -a android.intent.action.VIEW \
  -d "slopcode://remote-session?job=job_e2e&session=ses_e2e" >/dev/null

if [[ "${SSH_E2E_NETWORK_LOSS:-1}" == "1" ]]; then
  echo "Disabling emulator Wi-Fi and mobile data to verify the native SSH network-loss failure path."
  network_disabled=true
  adb shell svc wifi disable
  adb shell svc data disable
  run networkLossFailsClosedWhenTheHarnessHasDisabledNetworking -e sshNetworkLoss true
  adb shell svc data enable
  adb shell svc wifi enable
  network_disabled=false
fi

echo "Running deterministic local Android model coverage for persisted jobs, reconnect cursors, duplicate events, and notification actions."
./gradlew :app:testDebugUnitTest --tests dev.slopcode.android.RemoteJobModelsTest --tests dev.slopcode.android.SshModelsTest

echo "Native SSH release-candidate E2E passed for all five allowlisted agents. No protected credential values were logged."
