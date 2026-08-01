import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  RemoteTransportApprovalNotification,
  RemoteTransportBody,
  RemoteTransportBodyChunk,
  RemoteTransportError,
  RemoteTransportEventReplayRequest,
  RemoteTransportFrame,
  RemoteTransportFrameJson,
  RemoteTransportHttpRequest,
  RemoteTransportLimits,
  RemoteTransportMetadata,
  RemoteTransportPtyOpen,
  RemoteTransportQuestionNotification,
  RemoteTransportRemoteDirectory,
  RemoteTransportTarget,
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

const open = {
  version: "v1",
  kind: "request",
  type: "session.open",
  requestID: "req_open_1",
  idempotencyKey: "idem_open_1",
  target,
  auth: {
    method: "pairing-signature",
    pairingID: "pair_android",
    challenge: "chl_open_1",
    assertion: "qt-pairing-signature",
  },
} as const

const request = {
  version: "v1",
  kind: "request",
  requestID: "req_base_1",
  idempotencyKey: "idem_base_1",
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
        headers: { "content-type": "application/json" },
        body: "{\"message\":\"hello\"}",
      },
      {
        version: "v1",
        kind: "response",
        type: "http.response",
        requestID: "req_http_1",
        target,
        status: 200,
        headers: { "content-type": "application/json" },
        body: "{\"ok\":true}",
      },
      {
        version: "v1",
        kind: "stream",
        type: "http.chunk",
        requestID: "req_http_1",
        target,
        sequence: 0,
        chunk: "event: message\\ndata: hello\\n\\n",
        final: true,
      },
      {
        ...request,
        type: "event.replay",
        requestID: "req_replay_1",
        idempotencyKey: "idem_replay_1",
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
        data: "hello",
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
        chunk: "ls\n",
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
        target,
        ptyID: "pty_remote_1",
        sequence: 0,
        chunk: "ready\n",
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
        target,
        events: [
          {
            version: "v1",
            kind: "event",
            type: "event",
            target: { ...target, workspaceID: "wrk_other" },
            cursor: "cur_scope_1",
            event: "session.message",
            data: "leak",
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
    await expect(decode(RemoteTransportBody, "x".repeat(RemoteTransportLimits.maxBodyBytes + 1))).rejects.toThrow()
    await expect(
      decode(RemoteTransportBodyChunk, "x".repeat(RemoteTransportLimits.maxChunkBytes + 1)),
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
