import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  RemoteTransportApprovalNotification,
  RemoteTransportBody,
  RemoteTransportBodyChunk,
  RemoteTransportChallenge,
  RemoteTransportError,
  RemoteTransportEventReplayResponse,
  RemoteTransportEventReplayRequest,
  RemoteTransportFrame,
  RemoteTransportFrameJson,
  RemoteTransportHeaders,
  RemoteTransportHttpUpload,
  RemoteTransportHttpRequest,
  RemoteTransportInitialStreamState,
  RemoteTransportLimits,
  RemoteTransportMetadata,
  RemoteTransportPtyOpen,
  RemoteTransportQuestionNotification,
  RemoteTransportRemoteDirectory,
  RemoteTransportSessionOpened,
  RemoteTransportTarget,
  createRemoteTransportChallengeStore,
  createRemoteTransportIdempotencyStore,
  remoteTransportAcknowledgeStream,
  remoteTransportAdvanceStream,
  remoteTransportClaimIdempotency,
  remoteTransportComputeRequestDigest,
  remoteTransportComputeTargetDigest,
  remoteTransportCompleteIdempotency,
  remoteTransportCanonicalJson,
  remoteTransportCreateUploadStreamState,
  remoteTransportEncodeBase64Url,
  remoteTransportChallengeIsFresh,
  remoteTransportReleaseIdempotency,
  remoteTransportVerifyRequestDigest,
  remoteTransportVerifySessionProof,
  remoteTransportCapabilitiesMatch,
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
const capabilities = {
  offered: ["proof.ed25519.v1", "frame.bounds.v1", "http.upload.v1"],
  required: ["proof.ed25519.v1", "frame.bounds.v1", "http.upload.v1"],
} as const
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
  capabilities,
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
      signature: "A".repeat(86),
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
        type: "http.upload",
        requestID: "req_upload_1",
        idempotencyKey: "idem_upload_1",
        method: "PUT",
        path: "/api/file",
        contentLength: 131_072,
      },
      {
        version: "v1",
        kind: "stream",
        type: "http.upload.chunk",
        requestID: "req_upload_1",
        idempotencyKey: "idem_upload_1",
        requestDigest: digest,
        target,
        sequence: 0,
        chunk: base64("AP+A"),
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

  test("requires strict capability negotiation and rejects legacy downgrade", async () => {
    const { capabilities: _legacyCapabilities, ...legacy } = open
    await expect(decode(RemoteTransportFrame, legacy)).rejects.toThrow()
    await expect(
      decode(RemoteTransportSessionOpened, {
        version: "v1",
        kind: "response",
        type: "session.opened",
        requestID: "req_opened_1",
        idempotencyKey: "idem_opened_1",
        requestDigest: digest,
        target,
        sessionID: "ses_remote_1",
      }),
    ).rejects.toThrow()
    const opened = await decode(RemoteTransportSessionOpened, {
      version: "v1",
      kind: "response",
      type: "session.opened",
      requestID: "req_opened_1",
      idempotencyKey: "idem_opened_1",
      requestDigest: digest,
      target,
      sessionID: "ses_remote_1",
      capabilities: { accepted: capabilities.offered },
    })
    expect(remoteTransportCapabilitiesMatch(open.capabilities, opened.capabilities)).toBe(true)
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
    const requestDigest = await remoteTransportComputeRequestDigest(value)
    expect(
      await remoteTransportComputeRequestDigest({
        ...value,
        auth: { ...value.auth, proof: { ...value.auth.proof, signature: "A".repeat(86) } },
      }),
    ).toBe(requestDigest)
    const authenticated = await decode(RemoteTransportFrame, { ...value, requestDigest })
    if (authenticated.type !== "session.open") throw new Error("expected session.open")
    expect(await remoteTransportSessionAuthMatches(authenticated, authenticated.target)).toBe(false)
    expect(remoteTransportSessionProofTranscript(authenticated)).toContain('"domain":"slopcode-remote-v1"')
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
      requestDigest,
      auth: { ...open.auth, targetDigest: "c".repeat(64) },
    })
    if (wrongDigest.type !== "session.open") throw new Error("expected session.open")
    expect(await remoteTransportSessionAuthMatches(wrongDigest)).toBe(false)

    const challenge = await decode(RemoteTransportChallenge, open.auth.challenge)
    expect(remoteTransportChallengeIsFresh(challenge, challenge.expiresAt)).toBe(false)
  })

  test("requires a registered target, fresh challenge, exact digest, and Ed25519 proof", async () => {
    const now = 1_700_000_000_000
    const challenges = createRemoteTransportChallengeStore()
    const challenge = challenges.issue(now)
    const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])
    const typedTarget = await decode(RemoteTransportTarget, target)
    const targetDigest = await remoteTransportComputeTargetDigest(typedTarget)
    const unsigned = await decode(RemoteTransportFrame, {
      ...open,
      auth: { ...open.auth, challenge, targetDigest },
    })
    if (unsigned.type !== "session.open") throw new Error("expected session.open")
    const requestDigest = await remoteTransportComputeRequestDigest(unsigned)
    const request = await decode(RemoteTransportFrame, { ...unsigned, requestDigest })
    if (request.type !== "session.open") throw new Error("expected session.open")
    const signature = await crypto.subtle.sign(
      "Ed25519",
      keys.privateKey,
      new TextEncoder().encode(remoteTransportSessionProofTranscript(request)),
    )
    const signed = await decode(RemoteTransportFrame, {
      ...request,
      auth: { ...request.auth, proof: { ...request.auth.proof, signature: remoteTransportEncodeBase64Url(new Uint8Array(signature)) } },
    })
    if (signed.type !== "session.open") throw new Error("expected session.open")
    expect(
      await remoteTransportVerifySessionProof(
        signed,
        typedTarget,
        async () => false,
        challenges,
        now,
      ),
    ).toBe(false)
    expect(challenges.check(signed.auth.challenge, now)).toBe(true)
    expect(await remoteTransportSessionAuthMatches(signed, typedTarget, keys.publicKey, challenges, now)).toBe(true)
    expect(await remoteTransportVerifySessionProof(signed, typedTarget, keys.publicKey, challenges, now)).toBe(false)

    const other = createRemoteTransportChallengeStore()
    const otherTarget = await decode(RemoteTransportTarget, { ...target, remoteDirectory: "/srv/other" })
    expect(await remoteTransportVerifySessionProof(signed, otherTarget, keys.publicKey, other, now)).toBe(false)
    await expect(
      decode(RemoteTransportFrame, {
        ...signed,
        auth: { ...signed.auth, proof: { ...signed.auth.proof, signature: "A".repeat(84) } },
      }),
    ).rejects.toThrow()
  })

  test("bounds and prunes challenge records", () => {
    const store = createRemoteTransportChallengeStore({ maxEntries: 1, ttlMs: 10 })
    const first = store.issue(1_700_000_000_000)
    expect(() => store.issue(1_700_000_000_000)).toThrow()
    expect(store.check(first, 1_700_000_000_011)).toBe(false)
    expect(store.issue(1_700_000_000_011)).toBeTruthy()
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
    const typedRequest = await decode(RemoteTransportHttpRequest, { ...requestValue, requestDigest: computed })
    expect(typedRequest).toMatchObject({
      query: requestValue.query,
    })
    expect(await remoteTransportVerifyRequestDigest(typedRequest)).toBe(true)
    const wrongRequest = await decode(RemoteTransportHttpRequest, { ...requestValue, requestDigest: digest })
    expect(await remoteTransportVerifyRequestDigest(wrongRequest)).toBe(false)

    for (const query of ["a=%2fetc", "a=%252e%252e", "a=%2e%2e", "a=%26b%3Dc", "q=hello+world"]) {
      await expect(decode(RemoteTransportHttpRequest, { ...requestValue, query })).resolves.toMatchObject({ query })
    }
    for (const query of ["a=%ZZ", "a=%", "a=%23fragment", "a=%0d%0aInjected: yes"]) {
      await expect(decode(RemoteTransportHttpRequest, { ...requestValue, query })).rejects.toThrow()
    }
    for (const path of ["/api%2f..%2fetc", "/api%5c..%5cetc", "/api%252e%252e/etc"]) {
      await expect(
        decode(RemoteTransportHttpRequest, { ...requestValue, query: undefined, path }),
      ).rejects.toThrow()
    }

    const store = createRemoteTransportIdempotencyStore({ ttlMs: 1_000 })
    const registeredTarget = await decode(RemoteTransportTarget, target)
    const first = await remoteTransportClaimIdempotency(store, "ses_remote_1", registeredTarget, typedRequest)
    expect(first).toEqual({ status: "accepted", replay: false, state: "in-flight" })
    expect(await remoteTransportReleaseIdempotency(store, "ses_remote_1", registeredTarget, typedRequest.idempotencyKey, typedRequest.requestDigest)).toBe(true)
    expect(await remoteTransportClaimIdempotency(store, "ses_remote_1", registeredTarget, typedRequest)).toEqual({
      status: "accepted",
      replay: false,
      state: "in-flight",
    })
    expect(await remoteTransportCompleteIdempotency(store, "ses_remote_1", registeredTarget, typedRequest.idempotencyKey, typedRequest.requestDigest)).toBe(true)
    expect(await remoteTransportClaimIdempotency(store, "ses_remote_1", registeredTarget, typedRequest)).toEqual({
      status: "accepted",
      replay: true,
      state: "completed",
    })
    expect(await remoteTransportReleaseIdempotency(store, "ses_remote_1", registeredTarget, typedRequest.idempotencyKey, typedRequest.requestDigest)).toBe(false)
    const invalid = await remoteTransportClaimIdempotency(store, "ses_remote_1", registeredTarget, wrongRequest)
    expect(invalid).toMatchObject({ status: "invalid-digest" })
    const changedDigest = await remoteTransportComputeRequestDigest({ ...typedRequest, query: "different=1" })
    const changed = await decode(RemoteTransportHttpRequest, {
      ...typedRequest,
      query: "different=1",
      requestDigest: changedDigest,
    })
    expect(await remoteTransportClaimIdempotency(store, "ses_remote_1", registeredTarget, changed)).toMatchObject({
      status: "conflict",
    })
    const otherTarget = await decode(RemoteTransportTarget, { ...target, remoteDirectory: "/srv/other" })
    expect(await remoteTransportClaimIdempotency(store, "ses_remote_1", otherTarget, typedRequest)).toMatchObject({
      status: "target-mismatch",
    })

    const bounded = createRemoteTransportIdempotencyStore({ maxEntries: 1, ttlMs: 10 })
    const secondDigest = await remoteTransportComputeRequestDigest({ ...typedRequest, idempotencyKey: "idem_other_1" })
    const second = await decode(RemoteTransportHttpRequest, {
      ...typedRequest,
      idempotencyKey: "idem_other_1",
      requestDigest: secondDigest,
    })
    expect(await remoteTransportClaimIdempotency(bounded, "ses_remote_1", registeredTarget, typedRequest, 100)).toMatchObject({
      status: "accepted",
    })
    expect(await remoteTransportClaimIdempotency(bounded, "ses_remote_1", registeredTarget, second, 100)).toMatchObject({
      status: "capacity",
    })
    expect(await remoteTransportClaimIdempotency(bounded, "ses_remote_1", registeredTarget, second, 111)).toMatchObject({
      status: "accepted",
    })
  })

  test("orders canonical keys by UTF-8 bytes", () => {
    const first = remoteTransportCanonicalJson({ "é": "accent", "2": "two", "10": "ten" })
    const second = remoteTransportCanonicalJson({ "10": "ten", "é": "accent", "2": "two" })
    expect(first).toBe('{"10":"ten","2":"two","é":"accent"}')
    expect(second).toBe(first)
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
    await expect(
      decode(RemoteTransportFrame, {
        ...request,
        type: "http.request",
        method: "POST",
        path: "/api/upload",
        headers: Object.fromEntries(
          Array.from({ length: 40 }, (_, index) => [
            `x-large-${index}`,
            "x".repeat(RemoteTransportLimits.maxHeaderValueBytes),
          ]),
        ),
      }),
    ).rejects.toThrow()
  })

  test("accepts ordered stream chunks and rejects duplicates, gaps, and post-final data", async () => {
    const first = remoteTransportAdvanceStream(RemoteTransportInitialStreamState, {
      sequence: 0,
      chunk: utf8("a"),
      final: false,
    })
    expect(first).toMatchObject({ nextSequence: 1, final: false, totalBytes: 1, windowBytes: 1 })
    expect(remoteTransportAdvanceStream(first!, { sequence: 2, chunk: utf8("gap"), final: false })).toBeUndefined()
    const acknowledged = remoteTransportAcknowledgeStream(first!, 1)
    expect(acknowledged).toMatchObject({ windowBytes: 0, totalBytes: 1 })
    const done = remoteTransportAdvanceStream(acknowledged!, { sequence: 1, chunk: utf8("b"), final: true })
    expect(done).toMatchObject({ nextSequence: 2, final: true, totalBytes: 2, windowBytes: 1 })
    expect(remoteTransportAdvanceStream(done!, { sequence: 2, chunk: utf8("duplicate"), final: true })).toBeUndefined()
    expect(
      remoteTransportAdvanceStream(
        { ...RemoteTransportInitialStreamState, maxWindowBytes: 1 },
        { sequence: 0, chunk: utf8("ab"), final: false },
      ),
    ).toBeUndefined()

    const upload = await decode(RemoteTransportHttpUpload, {
      ...request,
      type: "http.upload",
      method: "PUT",
      path: "/api/file",
      contentLength: 2,
    })
    const uploadState = remoteTransportCreateUploadStreamState(upload)
    expect(remoteTransportAdvanceStream(uploadState, { sequence: 0, chunk: utf8("a"), final: true })).toBeUndefined()
    expect(remoteTransportAdvanceStream(uploadState, { sequence: 0, chunk: utf8("abc"), final: true })).toBeUndefined()
    const uploadFirst = remoteTransportAdvanceStream(uploadState, { sequence: 0, chunk: utf8("a"), final: false })
    const uploadDone = remoteTransportAdvanceStream(uploadFirst!, { sequence: 1, chunk: utf8("b"), final: true })
    expect(uploadDone?.totalBytes).toBe(2)
    expect(uploadDone?.final).toBe(true)
  })

  test("rejects duplicate JSON keys and duplicate replay cursors", async () => {
    const duplicate = JSON.stringify(open).replace('"kind":"request"', '"kind":"request","kind":"request"')
    await expect(Promise.resolve().then(() => decode(RemoteTransportFrameJson, duplicate))).rejects.toThrow()
    await expect(
      decode(RemoteTransportEventReplayResponse, {
        version: "v1",
        kind: "response",
        type: "event.replay",
        requestID: "req_replay_duplicate_1",
        idempotencyKey: "idem_replay_duplicate_1",
        requestDigest: digest,
        target,
        events: [
          {
            version: "v1",
            kind: "event",
            type: "event",
            target,
            cursor: "cur_duplicate_1",
            event: "session.message",
            data: utf8("one"),
          },
          {
            version: "v1",
            kind: "event",
            type: "event",
            target,
            cursor: "cur_duplicate_1",
            event: "session.message",
            data: utf8("two"),
          },
        ],
        hasMore: false,
      }),
    ).rejects.toThrow()
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
