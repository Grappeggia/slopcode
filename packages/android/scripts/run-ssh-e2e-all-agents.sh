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
require SSH_E2E_NETWORK_LOSS

if [[ "$SSH_E2E_CONFIRM" != "live-ssh" ]]; then
  echo "Set SSH_E2E_CONFIRM=live-ssh to acknowledge real remote CLI activity." >&2
  exit 2
fi

if [[ "$SSH_E2E_ALLOW_INSTALL" != "1" ]]; then
  echo "Set SSH_E2E_ALLOW_INSTALL=1 because this release-candidate harness tests the selected CLI installer." >&2
  exit 2
fi

if [[ "$SSH_E2E_NETWORK_LOSS" != "1" ]]; then
  echo "Set SSH_E2E_NETWORK_LOSS=1. The live harness always executes the real emulator network-loss scenario." >&2
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
  codex-cli|opencode-cli|claude-code|antigravity-cli) ;;
  *)
    echo "SSH_E2E_SETUP_AGENT must be one of: codex-cli, opencode-cli, claude-code, antigravity-cli." >&2
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
}
trap cleanup EXIT

stage_secret() {
  local source=$1
  local name=$2
  adb shell run-as "$package" sh -c "umask 077; mkdir -p files/ssh-e2e; cat > files/ssh-e2e/$name" <"$source"
}

run() {
  local method=$1
  local network_loss=${2:-false}
  local output
  output=$(mktemp)
  echo "Running $method"
  local -a args=(
    :app:connectedDebugAndroidTest
    "-Pandroid.testInstrumentationRunnerArguments.class=$test_class#$method"
    "-Pandroid.testInstrumentationRunnerArguments.sshE2E=true"
    "-Pandroid.testInstrumentationRunnerArguments.sshHost=$SSH_HOST"
    "-Pandroid.testInstrumentationRunnerArguments.sshPort=$port"
    "-Pandroid.testInstrumentationRunnerArguments.sshUser=$SSH_USER"
    "-Pandroid.testInstrumentationRunnerArguments.sshDirectory=$remote_root"
    "-Pandroid.testInstrumentationRunnerArguments.sshPrivateKeyFile=$key_name"
    "-Pandroid.testInstrumentationRunnerArguments.sshPasswordFile=$password_name"
    "-Pandroid.testInstrumentationRunnerArguments.sshSetupAgent=$SSH_E2E_SETUP_AGENT"
    "-Pandroid.testInstrumentationRunnerArguments.sshAllowInstall=true"
    "-Pandroid.testInstrumentationRunnerArguments.sshNetworkLossConfigured=true"
    "-Pandroid.testInstrumentationRunnerArguments.sshNetworkLoss=$network_loss"
  )
  if ! ./gradlew "${args[@]}" >"$output" 2>&1; then
    sed -n '1,240p' "$output" >&2
    rm -f "$output"
    return 1
  fi
  local result
  result=$(find app/build/outputs/androidTest-results/connected/debug -maxdepth 1 -type f -name 'TEST-*.xml' -print -quit)
  if [[ -z "$result" ]] || ! rg -q "<testsuite [^>]*failures=\"0\" errors=\"0\" skipped=\"0\"" "$result" || ! rg -q "testcase name=\"$method\"" "$result"; then
    sed -n '1,240p' "$output" >&2
    rm -f "$output"
    echo "Android connected instrumentation did not report a successful result for $method." >&2
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
stage_secret "$SSH_KEY_FILE" "$key_name"
stage_secret "$SSH_PASSWORD_FILE" "$password_name"

echo "Running real native SSH transport coverage against $SSH_HOST:$port. Remote artifacts are limited to $remote_root."
run firstUseRequiresTrustAndBothSupportedAuthenticationMethodsWork
run sftpListsScopedWorkspaceWithBreadcrumbDataAndHidesDotfilesByDefault
run configuredMissingAgentUsesTheAllowlistedInstallChecklist
run allFourAgentsPassPreflightSkipLoginAndCompleteOneShotPrompts
run interactivePtyAcceptsInputResizeCtrlCDisconnectAndReconnect
run changedHostKeyIsRejectedWithoutAcceptingTheReplacement
run wrongPasswordIsActionable
run configuredHostPersistsCredentialsBeforeProcessDeath

echo "Force-stopping the app before reconnecting with Keystore-backed credentials."
adb shell am force-stop "$package"
run storedCredentialsReconnectAfterProcessDeath

echo "Launching and asserting the exact-session notification deep-link after process restart."
run deepLinkIntentResolvesToMainActivity

echo "The mandatory emulator network-loss scenario drops an active PTY and reconnects after restoration."
run networkLossDropsActivePtyThenReconnectsAndResumes true

echo "Running deterministic local Android model coverage for persisted jobs, reconnect cursors, duplicate events, and notification actions."
./gradlew :app:testDebugUnitTest --tests dev.slopcode.android.RemoteJobModelsTest --tests dev.slopcode.android.SshModelsTest

echo "Native SSH release-candidate E2E passed for all four allowlisted agents. No protected credential values were logged."
