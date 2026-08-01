import { Credential } from "@slopcode-ai/core/credential"
import { IntegrationSchema } from "@slopcode-ai/core/integration/schema"
import {
  RemoteCapability,
  RemoteDevice,
  RemoteHost,
  RemotePairedHost,
  RemotePairing,
  RemotePairingCreateInput,
  RemotePairingID,
  RemotePairingRecord,
  RemoteTarget,
  RemoteWorkspace,
  RemoteWorkspaceSelectInput,
  RemoteWorkspaceSsh,
  RemoteWorkspaceTargetInput,
} from "../../../../../../protocol/src/remote"
import { Context, Effect, Layer, Schema } from "effect"
import os from "node:os"

const RemotePairingStore = Schema.Struct({
  version: Schema.Literal("v1"),
  pairings: Schema.Array(RemotePairing),
  targets: Schema.Array(RemoteWorkspaceTargetInput),
  selectedPairingID: Schema.optional(RemotePairingID),
}).annotate({ identifier: "RemotePairingStore" })

type PairingStore = typeof RemotePairingStore.Type
type WorkspaceID = typeof RemoteWorkspace.Type["id"]

function emptyStore(): PairingStore {
  return {
    version: "v1",
    pairings: [],
    targets: [],
    selectedPairingID: undefined,
  }
}

const decodeRemotePairing = Schema.decodeUnknownSync(RemotePairing)
const decodeRemotePairingRecord = Schema.decodeUnknownSync(RemotePairingRecord)
const decodeRemoteHost = Schema.decodeUnknownSync(RemoteHost)
const decodeRemotePairedHost = Schema.decodeUnknownSync(RemotePairedHost)
const decodeRemoteTarget = Schema.decodeUnknownSync(RemoteTarget)
const decodeRemoteWorkspace = Schema.decodeUnknownSync(RemoteWorkspace)
const decodeRemoteWorkspaceSsh = Schema.decodeUnknownSync(RemoteWorkspaceSsh)
const decodeRemoteWorkspaceTargetInput = Schema.decodeUnknownSync(RemoteWorkspaceTargetInput)
const decodePairingStore = (input: string): PairingStore => {
  try {
    return Schema.decodeUnknownSync(RemotePairingStore)(JSON.parse(input))
  } catch {
    try {
      return {
        ...emptyStore(),
        pairings: Schema.decodeUnknownSync(Schema.Array(RemotePairing))(JSON.parse(input)),
      }
    } catch {
      return emptyStore()
    }
  }
}
const remotePairingIntegrationID = Schema.decodeUnknownSync(IntegrationSchema.ID)("remote.pairing")
type WorkspaceMode = typeof RemoteWorkspace.Type["mode"]

export class SshValidationPendingError extends Schema.TaggedErrorClass<SshValidationPendingError>()(
  "RemotePairing.SshValidationPendingError",
  {
    message: Schema.String,
  },
) {}

export class TargetRegistrationError extends Schema.TaggedErrorClass<TargetRegistrationError>()(
  "RemotePairing.TargetRegistrationError",
  {
    message: Schema.String,
  },
) {}

export class TargetUnavailableError extends Schema.TaggedErrorClass<TargetUnavailableError>()(
  "RemotePairing.TargetUnavailableError",
  {
    message: Schema.String,
  },
) {}

function redact(pairing: typeof RemotePairing.Type) {
  return decodeRemotePairingRecord({
    version: pairing.version,
    id: pairing.id,
    device: pairing.device,
    host: pairing.host,
    workspace: pairing.workspace,
    capability: pairing.capability,
  })
}

function capability(mode: WorkspaceMode) {
  return Schema.decodeUnknownSync(RemoteCapability)({
    fs: true,
    command: true,
    pty: true,
    events: true,
    localWorkspace: mode === "local",
    sshWorkspace: mode === "ssh",
  })
}

function pairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Schema.decodeUnknownSync(RemotePairing.fields.code)(
    Array.from({ length: 6 }, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join(""),
  )
}

function pairingID() {
  return Schema.decodeUnknownSync(RemotePairingID)(`pair_${crypto.randomUUID().replaceAll("-", "")}`)
}

function host(mode: WorkspaceMode) {
  return decodeRemoteHost({
    id: `hst_${crypto.randomUUID().replaceAll("-", "")}`,
    name: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    version: os.release(),
    mode,
  })
}

function workspaceTarget(workspace: typeof RemoteWorkspace.Type) {
  if (workspace.mode === "local") return decodeRemoteTarget({ type: "local", directory: workspace.directory })
  return undefined
}

function sameWorkspace(left: typeof RemoteWorkspace.Type, right: typeof RemoteWorkspace.Type) {
  if (left.id !== right.id || left.mode !== right.mode || left.directory !== right.directory || left.name !== right.name) return false
  if (left.mode === "local" && right.mode === "local") return true
  if (left.mode === "ssh" && right.mode === "ssh") {
    return (
      left.remoteDirectory === right.remoteDirectory &&
      left.ssh.host === right.ssh.host &&
      left.ssh.port === right.ssh.port &&
      left.ssh.user === right.ssh.user
    )
  }
  return false
}

function requireRegisteredTarget(
  pairing: typeof RemotePairing.Type,
  store: PairingStore,
): typeof RemoteTarget.Type | TargetUnavailableError {
  const local = workspaceTarget(pairing.workspace)
  if (local) return local
  const found = store.targets.find((target) => sameWorkspace(target.workspace, pairing.workspace))
  if (found) return found.target
  return new TargetUnavailableError({
    message: "Remote workspace target must be registered by an authenticated desktop supervisor before selection",
  })
}

export type ResolvedTarget = {
  readonly pairing: typeof RemotePairingRecord.Type
  readonly target: typeof RemoteTarget.Type
}

export interface Interface {
  readonly hosts: () => Effect.Effect<ReadonlyArray<typeof RemotePairedHost.Type>>
  readonly create: (input: typeof RemotePairingCreateInput.Type) => Effect.Effect<typeof RemotePairing.Type>
  readonly revoke: (pairingID: typeof RemotePairingID.Type) => Effect.Effect<boolean>
  readonly registerTarget: (
    input: typeof RemoteWorkspaceTargetInput.Type,
  ) => Effect.Effect<void, TargetRegistrationError>
  readonly select: (
    input: typeof RemoteWorkspaceSelectInput.Type,
  ) => Effect.Effect<typeof RemotePairingRecord.Type | undefined, TargetUnavailableError>
  readonly target: (workspaceID: WorkspaceID) => Effect.Effect<ResolvedTarget | undefined, TargetUnavailableError>
  readonly validateSsh: (
    workspace: typeof RemoteWorkspaceSsh.Type,
  ) => Effect.Effect<typeof RemoteWorkspaceSsh.Type, SshValidationPendingError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/RemotePairing") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const credential = yield* Credential.Service

    const load = Effect.fn("RemotePairing.load")(function* () {
      const stored = (yield* credential.list(remotePairingIntegrationID))[0]
      if (!stored || stored.value.type !== "key") return { credential: stored, store: emptyStore() }
      return { credential: stored, store: decodePairingStore(stored.value.key) }
    })

    const save = Effect.fn("RemotePairing.save")(function* (store: PairingStore) {
      const stored = yield* load()
      if (store.pairings.length === 0 && store.targets.length === 0 && !store.selectedPairingID) {
        if (stored.credential) yield* credential.remove(stored.credential.id)
        return
      }
      yield* credential.create({
        integrationID: remotePairingIntegrationID,
        label: "remote-pairings",
        value: new Credential.Key({
          type: "key",
          key: JSON.stringify(store),
        }),
      })
    })

    const hosts = Effect.fn("RemotePairing.hosts")(function* () {
      const pairings = (yield* load()).store.pairings
      const grouped = new Map<string, Array<typeof RemotePairingRecord.Type>>()
      for (const pairing of pairings) {
        const next = redact(pairing)
        grouped.set(next.host.id, [...(grouped.get(next.host.id) ?? []), next])
      }
      return [...grouped.values()].map((pairings) =>
        decodeRemotePairedHost({
          host: pairings[0]!.host,
          pairings,
        }),
      )
    })

    const create = Effect.fn("RemotePairing.create")(function* (input: typeof RemotePairingCreateInput.Type) {
      const stored = yield* load()
      const existing = stored.store.pairings.find(
        (pairing) => pairing.device.id === input.device.id && pairing.workspace.id === input.workspace.id,
      )
      const next = decodeRemotePairing({
        version: "v1",
        id: existing?.id ?? pairingID(),
        code: pairingCode(),
        device: Schema.decodeUnknownSync(RemoteDevice)(input.device),
        host: existing?.host ?? host(input.workspace.mode),
        workspace: decodeRemoteWorkspace(input.workspace),
        capability: input.capability ?? capability(input.workspace.mode),
      })
      const selected = stored.store.selectedPairingID === next.id ? next.id : stored.store.selectedPairingID
      yield* save({
        ...stored.store,
        pairings: [...stored.store.pairings.filter((pairing) => pairing.id !== next.id), next],
        selectedPairingID: selected,
      })
      return next
    })

    const revoke = Effect.fn("RemotePairing.revoke")(function* (pairingID: typeof RemotePairingID.Type) {
      const stored = yield* load()
      const removed = stored.store.pairings.find((pairing) => pairing.id === pairingID)
      const pairings = stored.store.pairings.filter((pairing) => pairing.id !== pairingID)
      if (pairings.length === stored.store.pairings.length) return false
      const selectedPairingID = stored.store.selectedPairingID === pairingID ? undefined : stored.store.selectedPairingID
      const targets = removed
        ? stored.store.targets.filter((target) => target.workspace.id !== removed.workspace.id && target.pairingID !== pairingID)
        : stored.store.targets
      yield* save({ ...stored.store, pairings, selectedPairingID, targets })
      return true
    })

    const registerTarget = Effect.fn("RemotePairing.registerTarget")(function* (
      input: typeof RemoteWorkspaceTargetInput.Type,
    ) {
      const stored = yield* load()
      const pairing = input.pairingID
        ? stored.store.pairings.find((item) => item.id === input.pairingID)
        : stored.store.pairings.find((item) => item.workspace.id === input.workspace.id)
      if (input.pairingID && !pairing) {
        return yield* new TargetRegistrationError({
          message: `Remote pairing not found: ${input.pairingID}`,
        })
      }
      if (pairing && !sameWorkspace(pairing.workspace, input.workspace)) {
        return yield* new TargetRegistrationError({
          message: "Registered remote target must match the exact paired workspace selection",
        })
      }
      const target = decodeRemoteWorkspaceTargetInput({
        pairingID: input.pairingID,
        workspace: input.workspace,
        target: input.target,
      })
      yield* save({
        ...stored.store,
        targets: [...stored.store.targets.filter((item) => item.workspace.id !== target.workspace.id), target],
      })
    })

    const select = Effect.fn("RemotePairing.select")(function* (input: typeof RemoteWorkspaceSelectInput.Type) {
      const stored = yield* load()
      const pairing = stored.store.pairings.find((item) => item.id === input.pairingID)
      if (!pairing) return undefined
      const target = requireRegisteredTarget(pairing, stored.store)
      if (target instanceof TargetUnavailableError) return yield* target
      yield* save({ ...stored.store, selectedPairingID: pairing.id })
      return redact(pairing)
    })

    const target = Effect.fn("RemotePairing.target")(function* (workspaceID: WorkspaceID) {
      const stored = yield* load()
      const pairing = stored.store.selectedPairingID
        ? stored.store.pairings.find((item) => item.id === stored.store.selectedPairingID)
        : undefined
      if (!pairing || pairing.workspace.id !== workspaceID) return undefined
      const active = requireRegisteredTarget(pairing, stored.store)
      if (active instanceof TargetUnavailableError) return yield* active
      return { pairing: redact(pairing), target: active }
    })

    const validateSsh = Effect.fn("RemotePairing.validateSsh")(function* (workspace: typeof RemoteWorkspaceSsh.Type) {
      decodeRemoteWorkspaceSsh(workspace)
      const found = (yield* load()).store.targets.find((target) => sameWorkspace(target.workspace, workspace))
      if (found) return workspace
      return yield* new SshValidationPendingError({
        message: "SSH workspace must be validated by an authenticated desktop supervisor target before selection",
      })
    })

    return Service.of({
      hosts,
      create,
      revoke,
      registerTarget,
      select,
      target,
      validateSsh,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Credential.defaultLayer))
