# Slopcode Qt Remote Host Reference

This is a bounded Qt 6 host adapter slice for the Android remote mode. It is a
reusable reference library, not an internet relay and not a production-complete
remote implementation. It deliberately stops at transport validation, an SSH
target supervisor, and explicit local-server forwarding hooks.

## Build

Dependencies:

- Qt 6.4 or newer: Core, Network, WebSockets, and Test
- CMake 3.21 or newer
- A C++20 compiler
- OpenSSH `ssh` at runtime for the SSH supervisor

From the repository root:

```sh
cmake -S packages/remote-qt -B /tmp/slopcode-remote-qt-build -G Ninja \
  -DSLOPCODE_REMOTE_QT_BUILD_TESTS=ON
cmake --build /tmp/slopcode-remote-qt-build
ctest --test-dir /tmp/slopcode-remote-qt-build --output-on-failure
```

The reference host executable connects only when given an endpoint and a
runtime environment token:

```sh
SLOPCODE_REMOTE_SESSION_TOKEN='runtime-only-token' \
  /tmp/slopcode-remote-qt-build/slopcode-remote-qt-reference \
  --endpoint wss://control.example.invalid/remote
```

The token is put in the TLS WebSocket `Authorization` header by
`RemoteSession::connectTo`. It is not accepted in a frame, URL query, or
checked-in configuration. Do not pass it as a command-line argument.

## Frame contract

The transport accepts one UTF-8 JSON object per text message. The envelope has
exactly these required keys:

```json
{
  "version": "v1",
  "kind": "request",
  "requestID": "req_example-1",
  "target": {
    "type": "remote",
    "url": "http://127.0.0.1:43123"
  },
  "payload": { "operation": "health" }
}
```

`kind` is one of `request`, `response`, `event`, or `error`. `requestID` must
match `req_[A-Za-z0-9._:-]+`. The bounded target shapes are the conceptual
RemoteV1 forms `local + absolute directory` and `remote + explicit loopback
HTTP(S) URL`; target fields are also checked for unknown keys. A target may
carry non-sensitive string headers, but authorization, token, password,
identity, private-key, secret, and similar fields are rejected.

The parser rejects invalid JSON, duplicate object keys, unknown envelope or
target fields, wrong versions/kinds/IDs, non-loopback remote URLs, credential
material, binary WebSocket messages, and frames over 256 KiB. The WebSocket
session closes with a protocol error after a rejected frame and does not echo
the offending content.

## SSH supervisor

`SshTargetSupervisor` starts two `QProcess` instances with `program() ==
"ssh"` and `QStringList` arguments:

- the server process uses `-T <user@host> sh -se` and receives a small,
  shell-quoted start script on standard input;
- the tunnel process uses `-N -T -L
  127.0.0.1:<local>:127.0.0.1:<remote>`;
- `BatchMode`, password and keyboard-interactive authentication are disabled;
- strict host checking uses either a caller-supplied absolute `known_hosts`
  file or a runtime temporary file containing one validated pinned public key;
- an optional absolute identity path is passed to `ssh` at runtime, never in a
  RemoteV1 frame.

The remote folder must be an absolute POSIX path without `.` or `..`
traversal segments or control characters. The default remote command is
`slopcode serve --hostname 127.0.0.1 --port <remote-port>`. `Ready` means the
two local SSH processes have started; the caller should still perform its own
health check through `LocalSlopcodeForwarder`.

Stopping terminates both SSH processes and removes a temporary pinned
`known_hosts` file. No SSH password or password prompt path exists in this
slice.

## Local forwarding hooks and boundaries

`LocalSlopcodeForwarder` accepts only an explicit loopback HTTP(S) base URL and
offers `forwardHTTP()` and `forwardWebSocket()` methods. They return the
caller-owned `QNetworkReply` or `QWebSocket`; they do not implement a generic
proxy, relay, reconnect policy, remote target registration, or server health
policy. Paths must remain relative to the configured loopback origin, and
`Host`/`Content-Length` headers are not caller-overridable.

Intentional TODO/error boundaries for a future integration include pairing and
host registration, RemoteV1 operation dispatch, authenticated local-server
request policy, remote command discovery, tunnel health/backoff, reconnect and
resume semantics, and Android/UI lifecycle integration. Those belong in the
existing protocol, server, Android, or desktop layers and are intentionally not
changed here.

## Verification status

The deterministic Qt Test source covers valid frames, unknown fields, version,
kind and request ID failures, unsafe targets/payloads, duplicate keys, the
256 KiB limit, and encode/decode round trips. Qt 6 is not installed or
discoverable in the current development environment, so CMake configuration
and the Qt test executable were not run here; the expected first failure is
`find_package(Qt6 ...)` until the dependencies above are installed.
