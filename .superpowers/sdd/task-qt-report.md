# Qt RemoteV1 host bridge report

## Delivered

- Added the public `RemoteHttpBridge` Qt class. It subscribes to
  `RemoteSession::frameReceived` and dispatches only negotiated
  `http.request` frames.
- The bridge requires one validated configured target, verifies the canonical
  request digest, and preserves the request ID, idempotency key, digest, and
  target exactly in every `http.response` and RemoteV1 error envelope.
- The bridge requires an injected `Authorizer` callback. No callback means
  fail closed; no local request is sent. The callback is the explicit hook for
  the embedding application's pairing registry, proof verifier, and target
  authorization policy.
- Requests are forwarded only through `LocalSlopcodeForwarder`, retaining its
  numeric-loopback, path/query, method, redirect, proxy, and request-header
  restrictions. The bridge also excludes secret, hop-by-hop, and forwarding
  headers in both directions.
- Implemented bounded `utf8` and `base64` RemoteV1 body conversion. Local
  response bodies above 64 KiB, invalid status values, malformed response
  headers, and local network failures become bounded RemoteV1 error frames.
  Reply data is consumed incrementally with progress/content-length aborts, so
  `finish()` never performs an unbounded `readAll()`. Active replies are
  aborted and scheduled for deletion when the bridge is destroyed. Error text
  is truncated by UTF-8 byte length without splitting a code point.
- Updated CMake and the Qt README. The README names the new bridge and
  precisely states that relay, pairing registry, challenge authority, and
  Ed25519 proof verification remain external injectable responsibilities.

## Tests

Added `slopcode_remote_qt_http_bridge_test`, which uses a real TLS
`QWebSocketServer` for RemoteSession negotiation and a real loopback
`QTcpServer` for local HTTP forwarding. It covers:

- successful forwarding and bound `http.response` construction;
- `utf8` and `base64` request/response body conversion;
- configured-target mismatch rejection;
- invalid request-digest rejection;
- missing-authorizer fail-closed behavior;
- UTF-8-byte-bounded authorizer error messages;
- unsupported-body rejection before forwarding;
- bounded error output after a local network failure; and
- oversized response rejection before response-frame construction;
- malformed local response-header fallback; and
- safe abort/cleanup of an in-flight local reply, observed through the local
  server socket disconnect rather than only the absence of a control frame.

## Verification performed

- `git diff --check -- packages/remote-qt` passed.
- `cmake -S packages/remote-qt -B /tmp/slopcode-remote-qt-build -G Ninja -DSLOPCODE_REMOTE_QT_BUILD_TESTS=ON` could not configure because Qt 6.5+ is not installed or discoverable (`Qt6Config.cmake` is absent). Therefore the focused Qt build and CTest execution could not run in this environment.

## Scope

Only `packages/remote-qt` and this report were changed. Protocol, server,
Android, and desktop sources were not modified.

## Review fix

### Changed files

- `packages/remote-qt/src/http_bridge.cpp`
  - Set each local `QNetworkReply` read buffer to the existing 64 KiB RemoteV1
    response-body bound before connecting response handlers. This prevents the
    default unlimited Qt reply buffer from accumulating unknown-length or
    chunked response data while retaining the existing incremental body,
    progress, and error handling.
- `packages/remote-qt/tests/http_bridge_test.cpp`
  - Added a close-delimited (no `Content-Length`) oversized-response regression
    that holds the response after 64 KiB, asserts the reply read-buffer bound,
    releases one additional byte, and expects `too_large`.
  - Expanded local raw HTTP response-header coverage to deterministically test
    over-count, malformed-name, invalid-UTF-8-value, and control-byte-value
    responses.

### Verification

Command:

```sh
git diff --check -- packages/remote-qt && git diff --check -- .superpowers/sdd/task-qt-report.md
```

Output: no output (exit 0).

Command:

```sh
cmake -S packages/remote-qt -B /tmp/slopcode-remote-qt-review-build -G Ninja -DSLOPCODE_REMOTE_QT_BUILD_TESTS=ON
```

Output:

```text
CMake Error at CMakeLists.txt:14 (find_package):
  By not providing "FindQt6.cmake" in CMAKE_MODULE_PATH this project has
  asked CMake to find a package configuration file provided by "Qt6", but
  CMake did not find one.

  Could not find a package configuration file provided by "Qt6" (requested
  version 6.5) with any of the following names:

    Qt6Config.cmake
    qt6-config.cmake

  Add the installation prefix of "Qt6" to CMAKE_PREFIX_PATH or set "Qt6_DIR"
  to a directory containing one of the above files.  If "Qt6" provides a
  separate development package or SDK, be sure it has been installed.


-- Configuring incomplete, errors occurred!
```

### Limitation

Qt 6.5+ is unavailable in this environment, so the focused Qt build and
`slopcode_remote_qt_http_bridge_test` could not be compiled or run.
