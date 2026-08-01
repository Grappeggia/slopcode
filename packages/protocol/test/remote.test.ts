import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  RemoteEnvelope,
  RemoteEnvelopeJson,
  RemotePairing,
  RemoteWorkspace,
  RemoteWorkspaceJson,
} from "../src/remote"

describe("remote protocol contracts", () => {
  test("accepts a local request envelope", async () => {
    const value = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "request",
        id: "req_local-1",
        type: "workspace.open",
        idempotencyKey: "idem.local-1",
        device: {
          id: "dev_client-1",
          name: "Desktop App",
          platform: "darwin",
          arch: "arm64",
          version: "5.5.0",
        },
        host: {
          id: "hst_local-1",
          name: "Marcos MacBook",
          platform: "darwin",
          arch: "arm64",
          version: "14.6",
          mode: "local",
        },
        workspace: {
          id: "wrk_local-1",
          name: "slopcode",
          mode: "local",
          directory: "/Users/marcos/src/slopcode",
        },
        data: {
          action: "attach",
        },
      }),
    )

    expect(value.kind).toBe("request")
    if (value.kind !== "request") throw new Error("expected request")
    expect(value.workspace.mode).toBe("local")
  })

  test("accepts ssh pairing and event envelopes", async () => {
    const pairing = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemotePairing)({
        version: "v1",
        id: "pair_ssh-1",
        code: "AB12CD",
        device: {
          id: "dev_phone-1",
          name: "Android Remote",
          platform: "android",
          arch: "arm64",
          version: "1.0.0",
        },
        host: {
          id: "hst_linux-1",
          name: "build-box",
          platform: "linux",
          arch: "x64",
          version: "24.04",
          mode: "ssh",
        },
        workspace: {
          id: "wrk_remote-1",
          name: "slopcode-dev",
          mode: "ssh",
          directory: "/Users/marcos/src/slopcode",
          remoteDirectory: "/srv/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        },
        capability: {
          fs: true,
          command: true,
          pty: true,
          events: true,
          localWorkspace: false,
          sshWorkspace: true,
        },
      }),
    )
    const event = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "event",
        cursor: "cur_evt-2",
        type: "workspace.attached",
        requestID: "req_remote-1",
        data: {
          pairingID: pairing.id,
        },
      }),
    )

    expect(pairing.workspace.mode).toBe("ssh")
    expect(event.kind).toBe("event")
    if (event.kind !== "event") throw new Error("expected event")
    expect(String(event.requestID)).toBe("req_remote-1")
  })

  test("rejects malformed ssh workspaces and metadata", async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspace)({
          id: "wrk_remote-1",
          name: "slopcode-dev",
          mode: "ssh",
          directory: "/Users/marcos/src/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        }),
      ),
    ).rejects.toThrow()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspace)({
          id: "wrk_local-2",
          name: "slopcode",
          mode: "local",
          directory: "/Users/marcos/src/slopcode",
          remoteDirectory: "/srv/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        }),
      ),
    ).rejects.toThrow()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteEnvelope)({
          version: "v1",
          kind: "response",
          requestID: "request-1",
          ack: {
            requestID: "request-1",
            idempotencyKey: "x",
          },
          data: {},
        }),
      ),
    ).rejects.toThrow()
  })

  test("round trips workspaces and envelopes through JSON", async () => {
    const workspace = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspace)({
        id: "wrk_remote-2",
        name: "slopcode-dev",
        mode: "ssh",
        directory: "/Users/marcos/src/slopcode",
        remoteDirectory: "/srv/slopcode",
        ssh: {
          host: "build-box.internal",
          port: 2222,
          user: "marcos",
        },
      }),
    )
    const envelope = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "response",
        requestID: "req_remote-2",
        ack: {
          requestID: "req_remote-2",
          idempotencyKey: "idem.remote-2",
          cursor: "cur_evt-3",
        },
        data: {
          attached: true,
        },
      }),
    )
    const workspaceJson = Schema.encodeSync(RemoteWorkspaceJson)(workspace)
    const envelopeJson = Schema.encodeSync(RemoteEnvelopeJson)(envelope)

    expect(await Effect.runPromise(Schema.decodeUnknownEffect(RemoteWorkspaceJson)(workspaceJson))).toEqual(workspace)
    expect(await Effect.runPromise(Schema.decodeUnknownEffect(RemoteEnvelopeJson)(envelopeJson))).toEqual(envelope)
  })
})
