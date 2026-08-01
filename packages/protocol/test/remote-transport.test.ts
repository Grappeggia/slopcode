import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  RemoteTransportApprovalNotification,
  RemoteTransportBody,
  RemoteTransportBodyChunk,
  RemoteTransportChallenge,
  RemoteTransportError,
  RemoteTransportEventReplayRequest,
  RemoteTransportFrame,
  RemoteTransportFrameJson,
  RemoteTransportHeaders,
  RemoteTransportHttpRequest,
  RemoteTransportInitialStreamState,
  RemoteTransportLimits,
  RemoteTransportMetadata,
  RemoteTransportPtyOpen,
  RemoteTransportQuestionNotification,
  RemoteTransportRemoteDirectory,
  RemoteTransportTarget,
  remoteTransportAdvanceStream,
  remoteTransportComputeRequestDigest,
  remoteTransportComputeTargetDigest,
  remoteTransportConsumeChallenge,
  remoteTransportChallengeIsFresh,
  remoteTransportSessionAuthMatches,
  remoteTransportSessionProofTranscript,
} from "../src/remote-transport"

const decode = <S extends Schema.Top>(schema: S, input: unknown) =>
  Effect.runPromise(
    Schema.decodeUnknownEffect(schema)(input) as Effect.Effect<S["Type"], Schema.SchemaError>,
  )

const target = {
  hostID: "hst_desktop",
  pairingID: "pair_android",
  workspaceID: "wrk_slopcode",
  remoteDirectory: "/srv/slopcode",
} as const

const digest = "a".repeat(64)
const targetDigest = "b".repeat(64)
const utf8 = (data: string) => ({ encoding: "utf8" as const, data })
const base64 = (data: string) => ({ encoding: "base64" as const, data })

const open = {
  version: "v1",
  kind: "request",
  type: "session.open",
  requestID: "req_open_1",
  idempotencyKey: "idem_open_1",
  requestDigest: digest,
  target,
  auth: {
    method: "pairing-signature",
    pairingID: "pair_android",
    target,
    targetDigest,
    challenge: {
      issuer: "server",
      id: "chl_open_1",
      nonce: "server_nonce_123456",
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_000_060_000,
      oneTime: true,
    },
    proof: {
      algorithm: "ed25519",
      encoding: "base64url",
      signature: "qt_pairing_signature",
    },
  },
} as const

const request = {
  version: "v1",
  kind: "request",
  requestID: "req_base_1",
  idempotencyKey: "idem_base_1",
  requestDigest: digest,
  target,
} as const

describe("remote transport protocol contracts", () => {
  test("accepts session, HTTP, replay, PTY, notification, and error frames", async () => {
    const frames = [
      open,
      {
        ...request,
        type: "session.close",
        requestID: "req_close_1",
        idempotencyKey: "idem_close_1",
        sessionID: "ses_remote_1",
      },
      {
        ...request,
        type: "http.request",
        requestID: "req_http_1",
        idempotencyKey: "idem_http_1",
        method: "POST",
        path: "/api/session/ses_remote_1/message",
        query: "page=1&cursor=cur_events_1",
        headers: { "content-type": "application/json" },
        body: utf8("{\"message\":\"hello\"}"),
      },
      {
        version: "v1",
        kind: "response",
        type: "http.response",
        requestID: "req_http_1",
        idempotencyKey: "idem_http_1",
        requestDigest: digest,
        target,
        status: 200,
        headers: { "content-type": "application/json" },
        body: utf8("{\"ok\":true}"),
      },
      {
        version: "v1",
        kind: "stream",
        type: "http.chunk",
        requestID: "req_http_1",
        idempotencyKey: "idem_http_1",
        requestDigest: digest,
        target,
        sequence: 0,
        chunk: utf8("event: message\\ndata: hello\\n\\n"),
        final: true,
      },
      {
        ...request,
        type: "event.replay",
        requestID: "req_replay_1",
        idempotencyKey: "idem_replay_1",
        requestDigest: digest,
        cursor: "cur_events_1",
        limit: 20,
      },
      {
        version: "v1",
        kind: "event",
        type: "event",
        target,
        cursor: "cur_events_2",
        event: "session.message",
        data: utf8("hello"),
        replayed: true,
      },
      {
        ...request,
        type: "pty.open",
        requestID: "req_pty_open_1",
        idempotencyKey: "idem_pty_open_1",
        ptyID: "pty_remote_1",
        command: "bash",
        args: ["-lc", "printf ready"],
        cwd: "/srv/slopcode/packages/protocol",
        rows: 40,
        cols: 120,
      },
      {
        ...request,
        type: "pty.input",
        requestID: "req_pty_input_1",
        idempotencyKey: "idem_pty_input_1",
        ptyID: "pty_remote_1",
        chunk: utf8("ls\n"),
      },
      {
        ...request,
        type: "pty.resize",
        requestID: "req_pty_resize_1",
        idempotencyKey: "idem_pty_resize_1",
        ptyID: "pty_remote_1",
        rows: 50,
        cols: 140,
      },
      {
        version: "v1",
        kind: "stream",
        type: "pty.output",
        requestID: "req_pty_open_1",
        idempotencyKey: "idem_pty_open_1",
        requestDigest: digest,
        target,
        ptyID: "pty_remote_1",
        sequence: 0,
        chunk: utf8("ready\n"),
        final: false,
      },
      {
        ...request,
        type: "pty.close",
        requestID: "req_pty_close_1",
        idempotencyKey: "idem_pty_close_1",
        ptyID: "pty_remote_1",
      },
      {
        version: "v1",
        kind: "event",
        type: "approval.request",
        target,
        notificationID: "ntf_approval_1",
        requestID: "req_http_1",
        action: "shell",
        resources: ["bash -lc printf ready"],
        reason: "The session requested a shell command",
        metadata: { source: "relay" },
      },
      {
        version: "v1",
        kind: "event",
        type: "question.request",
        target,
        notificationID: "ntf_question_1",
        questions: [
          {
            question: "Continue?",
            header: "Confirm",
            options: [{ label: "Yes", value: "yes" }],
            multiple: false,
          },
        ],
      },
      {
        version: "v1",
        kind: "error",
        type: "error",
        requestID: "req_http_1",
        idempotencyKey: "idem_http_1",
        requestDigest: digest,
        target,
        code: "out_of_scope",
        message: "The selected workspace does not own this path",
        retryable: false,
        details: { boundary: "remoteDirectory" },
      },
    ]

    await Promise.all(frames.map((frame) => decode(RemoteTransportFrame, frame)))
    expect(await decode(RemoteTransportTarget, target)).toMatchObject(target)
  })

  test("round trips a JSON-lines frame", async () => {
    const value = await decode(RemoteTransportFrame, open)
    const encoded = Schema.encodeSync(RemoteTransportFrameJson)(value)
    const decoded = await decode(RemoteTransportFrameJson, encoded)

    expect(decoded).toEqual(value)
  })

  test("binds session proof transcripts and consumes challenges once", async () => {
    const actualTargetDigest = await remoteTransportComputeTargetDigest(target)
    const value = await decode(RemoteTransportFrame, {
      ...open,
      auth: {
        ...open.auth,
        targetDigest: actualTargetDigest,
      },
    })

    if (value.type !== "session.open") throw new Error("expected session.open")
    expect(await remoteTransportSessionAuthMatches(value)).toBe(true)
    expect(remoteTransportSessionProofTranscript(value)).toContain('"domain":"slopcode-remote-v1"')
    await expect(
      decode(RemoteTransportFrame, {
        ...open,
        auth: {
          ...open.auth,
          target: { ...target, remoteDirectory: "/srv/other" },
          targetDigest: actualTargetDigest,
        },
      }),
    ).rejects.toThrow()
    const wrongDigest = await decode(RemoteTransportFrame, {
      ...open,
      auth: { ...open.auth, targetDigest: "c".repeat(64) },
    })
    if (wrongDigest.type !== "session.open") throw new Error("expected session.open")
    expect(await remoteTransportSessionAuthMatches(wrongDigest)).toBe(false)

    const challenge = await decode(RemoteTransportChallenge, open.auth.challenge)
    const consumed = remoteTransportConsumeChallenge(new Set(), challenge, challenge.issuedAt)
    expect(consumed?.has(challenge.id)).toBe(true)
    expect(remoteTransportConsumeChallenge(consumed ?? new Set(), challenge, challenge.issuedAt)).toBeUndefined()
    expect(remoteTransportChallengeIsFresh(challenge, challenge.expiresAt)).toBe(false)
  })

  test("binds request digests to canonical JSON and supports bounded query strings", async () => {
    const requestValue = {
      ...request,
      type: "http.request" as const,
      method: "GET" as const,
      path: "/api/location",
      query: "cursor=abc%20def&limit=20",
    }
    const computed = await remoteTransportComputeRequestDigest(requestValue)
    expect(computed).toMatch(/^[0-9a-f]{64}$/)
    expect(await decode(RemoteTransportHttpRequest, { ...requestValue, requestDigest: computed })).toMatchObject({
      query: requestValue.query,
    })

    for (const query of ["a=%2fetc", "a=%252e%252e", "a=%2e%2e", "a=%ZZ"]) {
      await expect(
        decode(RemoteTransportHttpRequest, { ...requestValue, query }),
      ).rejects.toThrow()
    }
    for (const path of ["/api%2f..%2fetc", "/api%5c..%5cetc", "/api%252e%252e/etc"]) {
      await expect(
        decode(RemoteTransportHttpRequest, { ...requestValue, query: undefined, path }),
      ).rejects.toThrow()
    }
  })

  test("rejects unsafe duplicate and forwarding headers", async () => {
    await expect(
      decode(RemoteTransportHeaders, {
        "Content-Type": "application/json",
        "content-type": "application/json",
      }),
    ).rejects.toThrow()
    await expect(decode(RemoteTransportHeaders, { Connection: "close" })).rejects.toThrow()
    await expect(decode(RemoteTransportHeaders, { "X-Forwarded-For": "127.0.0.1" })).rejects.toThrow()
    await expect(decode(RemoteTransportHeaders, { "x-safe": "ok\u0007" })).rejects.toThrow()
    await expect(
      decode(RemoteTransportHeaders, JSON.parse('{"__proto__":"polluted"}')),
    ).rejects.toThrow()
  })

  test("enforces discriminated UTF-8/base64 bodies and frame byte limits", async () => {
    await expect(decode(RemoteTransportBody, utf8("é"))).resolves.toEqual(utf8("é"))
    await expect(decode(RemoteTransportBody, base64("AP+A"))).resolves.toEqual(base64("AP+A"))
    await expect(decode(RemoteTransportBody, base64("not base64!"))).rejects.toThrow()
    await expect(decode(RemoteTransportBody, { encoding: "base64", data: "Zm8" })).rejects.toThrow()

    const oversized = JSON.stringify({
      ...request,
      type: "http.request",
      method: "POST",
      path: "/api/upload",
      body: utf8("x".repeat(RemoteTransportLimits.maxFrameBytes)),
    })
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(RemoteTransportLimits.maxFrameBytes)
    await expect(decode(RemoteTransportFrameJson, oversized)).rejects.toThrow()
  })

  test("accepts ordered stream chunks and rejects duplicates, gaps, and post-final data", () => {
    const first = remoteTransportAdvanceStream(RemoteTransportInitialStreamState, { sequence: 0, final: false })
    expect(first).toEqual({ nextSequence: 1, final: false })
    expect(remoteTransportAdvanceStream(first!, { sequence: 2, final: false })).toBeUndefined()
    const done = remoteTransportAdvanceStream(first!, { sequence: 1, final: true })
    expect(done).toEqual({ nextSequence: 2, final: true })
    expect(remoteTransportAdvanceStream(done!, { sequence: 2, final: true })).toBeUndefined()
  })

  test("rejects unknown fields at every fixed object boundary", async () => {
    await expect(decode(RemoteTransportFrame, { ...open, unexpected: true })).rejects.toThrow()
    await expect(
      decode(RemoteTransportFrame, {
        ...request,
        target: { ...target, unexpected: true },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportFrame, {
        ...request,
        auth: { ...open.auth, unexpected: true },
      }),
    ).rejects.toThrow()
  })

  test("rejects targets and paths outside the selected remote directory", async () => {
    await expect(decode(RemoteTransportRemoteDirectory, "srv/slopcode")).rejects.toThrow()
    await expect(
      decode(RemoteTransportTarget, {
        ...target,
        remoteDirectory: "/srv/slopcode/../secrets",
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportPtyOpen, {
        ...request,
        type: "pty.open",
        requestID: "req_pty_scope_1",
        idempotencyKey: "idem_pty_scope_1",
        ptyID: "pty_scope_1",
        rows: 40,
        cols: 120,
        cwd: "/srv/other-workspace",
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportFrame, {
        ...open,
        target: { ...target, pairingID: "pair_other" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportFrame, {
        version: "v1",
        kind: "response",
        type: "event.replay",
        requestID: "req_replay_scope_1",
        idempotencyKey: "idem_replay_scope_1",
        requestDigest: digest,
        target,
        events: [
          {
            version: "v1",
            kind: "event",
            type: "event",
            target: { ...target, workspaceID: "wrk_other" },
            cursor: "cur_scope_1",
            event: "session.message",
            data: utf8("leak"),
          },
        ],
        hasMore: false,
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportHttpRequest, {
        ...request,
        type: "http.request",
        requestID: "req_http_path_1",
        idempotencyKey: "idem_http_path_1",
        requestDigest: digest,
        method: "GET",
        path: "/api/../etc/passwd",
      }),
    ).rejects.toThrow()
  })

  test("rejects oversized headers, metadata, bodies, and chunks", async () => {
    await expect(
      decode(RemoteTransportMetadata, {
        trace: "x".repeat(RemoteTransportLimits.maxMetadataValueBytes + 1),
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportHttpRequest, {
        ...request,
        type: "http.request",
        requestID: "req_http_size_1",
        idempotencyKey: "idem_http_size_1",
        method: "POST",
        path: "/api/upload",
        headers: { "x-large": "x".repeat(RemoteTransportLimits.maxHeaderValueBytes + 1) },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportBody, utf8("x".repeat(RemoteTransportLimits.maxBodyBytes + 1))),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportBodyChunk, utf8("x".repeat(RemoteTransportLimits.maxChunkBytes + 1))),
    ).rejects.toThrow()
  })

  test("rejects private key, password, and other secret-shaped fields", async () => {
    await expect(decode(RemoteTransportFrame, { ...open, password: "not-allowed" })).rejects.toThrow()
    await expect(
      decode(RemoteTransportFrame, {
        ...open,
        target: { ...target, privateKey: "not-allowed" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportApprovalNotification, {
        version: "v1",
        kind: "event",
        type: "approval.request",
        target,
        notificationID: "ntf_secret_1",
        action: "shell",
        resources: ["bash"],
        reason: "approval",
        metadata: { apiKey: "not-allowed" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportQuestionNotification, {
        version: "v1",
        kind: "event",
        type: "question.request",
        target,
        notificationID: "ntf_secret_2",
        questions: [],
        metadata: { password: "not-allowed" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportHttpRequest, {
        ...request,
        type: "http.request",
        method: "GET",
        path: "/api/health",
        headers: { "x-api-key": "not-allowed" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(RemoteTransportError, {
        version: "v1",
        kind: "error",
        type: "error",
        code: "internal",
        message: "failure",
        retryable: false,
        details: { private_key: "not-allowed" },
      }),
    ).rejects.toThrow()
  })
})
