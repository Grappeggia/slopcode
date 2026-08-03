#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SSH_KEY_FILE:-}" || -z "${SSH_HOST:-}" || -z "${SSH_USER:-}" ]]; then
  echo "Set SSH_KEY_FILE, SSH_HOST, and SSH_USER for the disposable live SSH fixture." >&2
  exit 2
fi

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "SSH_KEY_FILE does not exist." >&2
  exit 2
fi

key=$(base64 -w0 "$SSH_KEY_FILE")
directory=${SSH_DIRECTORY:-/tmp}
port=${SSH_PORT:-22}

failed=0
for agent in slopcode-cli codex-cli opencode-cli claude-code; do
  echo "Running native SSH E2E for $agent"
  if ! ./gradlew :app:connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.sshKeyB64="$key" \
    -Pandroid.testInstrumentationRunnerArguments.sshHost="$SSH_HOST" \
    -Pandroid.testInstrumentationRunnerArguments.sshPort="$port" \
    -Pandroid.testInstrumentationRunnerArguments.sshUser="$SSH_USER" \
    -Pandroid.testInstrumentationRunnerArguments.sshDirectory="$directory" \
    -Pandroid.testInstrumentationRunnerArguments.sshAgent="$agent"; then
    echo "Native SSH E2E failed for $agent" >&2
    failed=1
  fi
done

if (( failed != 0 )); then
  echo "Native SSH E2E failed for one or more allowlisted agents." >&2
  exit 1
fi

echo "Native SSH E2E passed for all four allowlisted agents."
