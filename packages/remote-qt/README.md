# Slopcode Qt RemoteV1 reference adapter

This package is a bounded Qt 6.5+ reference adapter for a Slopcode remote
host. It validates and encodes the final discriminated RemoteV1 JSON contract,
supervises a strict SSH connection, and provides narrowly scoped loopback
forwarding hooks. It is not a production relay, pairing service, or complete
remote-agent implementation.

## Build

Dependencies are Qt 6.5 or newer (Core, Network, WebSockets, and Test), CMake
3.21 or newer, a C++20 compiler, and OpenSSH at runtime for the SSH supervisor.

```sh
cmake -S packages/remote-qt -B /tmp/slopcode-remote-qt-build -G Ninja \
  -DSLOPCODE_REMOTE_QT_BUILD_TESTS=ON
cmake --build /tmp/slopcode-remote-qt-build
ctest --test-dir /tmp/slopcode-remote-qt-build --output-on-failure
```

The reference executable accepts only a `wss://` endpoint. Authentication is
an application frame; no bearer header, environment token, URL credential, or
runtime secret is created by this package.

## Final wire contract

Every text message is one UTF-8 JSON object no larger than 256 KiB. There is no
generic `payload`, URL, loopback, or bearer envelope. Request, response, and
stream frames carry the exact scoped target and request binding fields:

```json
{
  "version": "v1",
  "kind": "request",
  "type": "session.open",
  "requestID": "req_open_1",
  "idempotencyKey": "idem_open_1",
  "requestDigest": "<64 lowercase hex characters>",
  "target": {
    "hostID": "hst_desktop",
    "pairingID": "pair_android",
    "workspaceID": "wrk_slopcode",
    "remoteDirectory": "/srv/slopcode"
  },
  "capabilities": {
    "offered": ["proof.ed25519.v1", "frame.bounds.v1", "http.upload.v1"],
    "required": ["proof.ed25519.v1", "frame.bounds.v1", "http.upload.v1"]
  },
  "auth": {
    "method": "pairing-signature",
    "pairingID": "pair_android",
    "target": {
      "hostID": "hst_desktop",
      "pairingID": "pair_android",
      "workspaceID": "wrk_slopcode",
      "remoteDirectory": "/srv/slopcode"
    },
    "targetDigest": "<64 lowercase hex characters>",
    "challenge": {
      "issuer": "server",
      "id": "chl_example",
      "nonce": "<canonical base64url nonce>",
      "issuedAt": 1700000000000,
      "expiresAt": 1700000060000,
      "oneTime": true
    },
    "proof": {
      "algorithm": "ed25519",
      "encoding": "base64url",
      "signature": "<canonical unpadded base64url Ed25519 signature>"
    }
  }
}
```

The three capability names are mandatory and are negotiated strictly. Body
values are `{ "encoding": "utf8" | "base64", "data": "..." }`; regular
HTTP bodies and response bodies are limited to 64 KiB, while
`http.upload`/`http.upload.chunk` use ordered chunks with a declared
`contentLength`, a 16 MiB aggregate limit, and a 256 KiB flow-control window.
HTTP paths, queries, headers, metadata, PTY arguments, replay events, IDs,
duplicate JSON keys, nesting, and object/array sizes are bounded as specified
by `packages/protocol/src/remote-transport.ts`.

The adapter implements canonical UTF-8 JSON key ordering, SHA-256 digest and
session-proof-transcript helpers, plus process-local idempotency and
stream-state helpers. It does not
implement the production Ed25519 public-key verifier, pairing registry,
one-time challenge authority, or multi-process relay. Consequently,
`RemoteSession` rejects an incoming `session.open` after shape validation with
a protocol error; integrating code must verify the registered target,
request/target digests, challenge consumption, and Ed25519 transcript before
dispatching it. A syntactically valid proof is never treated as authenticated
by this reference adapter.

## SSH and local forwarding

The SSH supervisor validates an absolute normalized POSIX remote folder, uses
argv-only `QProcess` execution, disables password and keyboard-interactive
authentication, and requires strict host-key checking through either a caller
supplied `known_hosts` file or one pinned runtime key. The tunnel asks OpenSSH
for the port atomically with:

```text
-L 127.0.0.1:0:127.0.0.1:<remote-port>
```

It parses OpenSSH's assigned `127.0.0.1` listening port before emitting
`ready`; it never performs a listen/close/reuse port allocation.

`LocalSlopcodeForwarder` accepts numeric loopback HTTP(S) origins only,
disables proxies, permits only the RemoteV1 HTTP methods, applies header and
body bounds, rejects secret/hop-by-hop/forwarding headers, and manually
revalidates every redirect against the same loopback origin and safe path or
query. It is a forwarding hook, not a transparent proxy or remote dispatch
layer.

## Verification status and intentional limits

The Qt tests cover the discriminated frame variants, strict capabilities,
auth/proof shape, duplicate keys, limits, paths/queries/headers, replay
bindings, stream state, SSH dynamic-port arguments, and forwarding policy.
Qt 6.5 is not discoverable in the current development environment, so the Qt
CMake configure/build/test executable cannot run here until the dependency is
installed; static scope and whitespace checks are still run before commits.
