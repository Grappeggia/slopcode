import { Credential } from "@slopcode-ai/core/credential"
import { CredentialTable } from "@slopcode-ai/core/credential/sql"
import { Database } from "@slopcode-ai/core/database/database"
import { IntegrationSchema } from "@slopcode-ai/core/integration/schema"
import {
  RemoteCapability,
  RemoteDevice,
  RemoteHost,
  RemoteHostID,
  RemotePairedHost,
  RemotePairing,
  RemotePairingCreateInput,
  RemotePairingID,
  RemotePairingRecord,
  RemotePairingSelection,
  RemoteSelectionNonce,
  RemoteTarget,
  RemoteWorkspace,
  RemoteWorkspaceSelectInput,
  RemoteWorkspaceSsh,
  RemoteWorkspaceTargetInput,
} from "../../../../../../protocol/src/remote"
import { asc, eq } from "drizzle-orm"
import { Context, Effect, Layer, Schema, Semaphore, Struct } from "effect"
import path from "node:path"
import os from "node:os"

const StoredPairing = Schema.Struct({
  ...Struct.omit(RemotePairing.fields, ["selection"]),
  selection: Schema.optional(RemotePairingSelection),
}).annotate({ identifier: "RemotePairing.StoredPairing" })

const StoredTarget = Schema.Struct({
  pairingID: RemotePairingID,
  hostID: RemoteHostID,
  workspace: RemoteWorkspace,
  target: RemoteTarget,
}).annotate({ identifier: "RemotePairing.StoredTarget" })

const StoredScope = Schema.Struct({
  projectID: Schema.String,
  directory: Schema.String,
  pairings: Schema.Array(StoredPairing),
  targets: Schema.Array(StoredTarget),
  selectedPairingID: Schema.optional(RemotePairingID),
}).annotate({ identifier: "RemotePairing.Scope" })

const RemotePairingStore = Schema.Struct({
  version: Schema.Literal("v2"),
  revision: Schema.Number,
  scopes: Schema.Array(StoredScope),
}).annotate({ identifier: "RemotePairingStore" })

type PairingStore = typeof RemotePairingStore.Type
type ScopeState = typeof StoredScope.Type
type StoredPairingState = typeof StoredPairing.Type
type WorkspaceID = (typeof RemoteWorkspace.Type)["id"]

export type PairingScope = {
  readonly projectID: string
  readonly directory: string
}

function emptyStore(): PairingStore {
  return {
    version: "v2",
    revision: 0,
    scopes: [],
  }
}

function normalizeScope(scope: PairingScope): PairingScope {
  return {
    projectID: scope.projectID,
    directory: path.resolve(scope.directory),
  }
}

function scopeKey(scope: PairingScope) {
  const normalized = normalizeScope(scope)
  return `${normalized.projectID}\u0000${normalized.directory}`
}

function emptyScope(scope: PairingScope): ScopeState {
  const normalized = normalizeScope(scope)
  return {
    projectID: normalized.projectID,
    directory: normalized.directory,
    pairings: [],
    targets: [],
    selectedPairingID: undefined,
  }
}

function findScope(store: PairingStore, scope: PairingScope) {
  const key = scopeKey(scope)
  return store.scopes.find((item) => scopeKey(item) === key)
}

function putScope(store: PairingStore, next: ScopeState) {
  const key = scopeKey(next)
  const scopes = store.scopes.filter((item) => scopeKey(item) !== key)
  if (next.pairings.length || next.targets.length || next.selectedPairingID) scopes.push(next)
  return {
    ...store,
    revision: store.revision + 1,
    scopes,
  }
}

const decodeRemotePairing = Schema.decodeUnknownSync(RemotePairing)
const decodeStoredPairing = Schema.decodeUnknownSync(StoredPairing)
const decodeRemotePairingRecord = Schema.decodeUnknownSync(RemotePairingRecord)
const decodeRemoteHost = Schema.decodeUnknownSync(RemoteHost)
const decodeRemotePairedHost = Schema.decodeUnknownSync(RemotePairedHost)
const decodeRemoteTarget = Schema.decodeUnknownSync(RemoteTarget)
const decodeRemoteWorkspace = Schema.decodeUnknownSync(RemoteWorkspace)
const decodeRemoteWorkspaceSsh = Schema.decodeUnknownSync(RemoteWorkspaceSsh)
const decodeCredential = Schema.decodeUnknownSync(Credential.Info)
const decodePairingStore = (input: string): PairingStore => {
  try {
    return Schema.decodeUnknownSync(RemotePairingStore)(JSON.parse(input))
  } catch {
    // Older stores did not carry instance ownership. Treat them as unusable
    // instead of making an unscoped capability available after an upgrade.
    return emptyStore()
  }
}
const remotePairingIntegrationID = Schema.decodeUnknownSync(IntegrationSchema.ID)("remote.pairing")
type WorkspaceMode = (typeof RemoteWorkspace.Type)["mode"]

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

export class SelectionUnavailableError extends Schema.TaggedErrorClass<SelectionUnavailableError>()(
  "RemotePairing.SelectionUnavailableError",
  {
    message: Schema.String,
  },
) {}

function redact(pairing: StoredPairingState) {
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

function selectionNonce() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
  return Schema.decodeUnknownSync(RemoteSelectionNonce)(
    Array.from({ length: 32 }, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join(
      "",
    ),
  )
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
  if (
    left.id !== right.id ||
    left.mode !== right.mode ||
    left.directory !== right.directory ||
    left.name !== right.name
  ) {
    return false
  }
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
  pairing: StoredPairingState,
  scope: ScopeState,
): typeof RemoteTarget.Type | TargetUnavailableError {
  const local = workspaceTarget(pairing.workspace)
  if (local) return local
  const found = scope.targets.find(
    (target) =>
      target.pairingID === pairing.id &&
      target.hostID === pairing.host.id &&
      sameWorkspace(target.workspace, pairing.workspace),
  )
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
  readonly hosts: (scope: PairingScope) => Effect.Effect<ReadonlyArray<typeof RemotePairedHost.Type>>
  readonly create: (
    input: typeof RemotePairingCreateInput.Type,
    scope: PairingScope,
  ) => Effect.Effect<typeof RemotePairing.Type>
  readonly revoke: (pairingID: typeof RemotePairingID.Type, scope: PairingScope) => Effect.Effect<boolean>
  readonly registerTarget: (
    input: typeof RemoteWorkspaceTargetInput.Type,
    scope: PairingScope,
  ) => Effect.Effect<void, TargetRegistrationError>
  readonly select: (
    input: typeof RemoteWorkspaceSelectInput.Type,
    scope: PairingScope,
  ) => Effect.Effect<typeof RemotePairingRecord.Type | undefined, TargetUnavailableError | SelectionUnavailableError>
  readonly target: (
    workspaceID: WorkspaceID,
    scope: PairingScope,
  ) => Effect.Effect<ResolvedTarget | undefined, TargetUnavailableError>
  readonly validateSsh: (
    workspace: typeof RemoteWorkspaceSsh.Type,
    scope: PairingScope,
  ) => Effect.Effect<typeof RemoteWorkspaceSsh.Type, SshValidationPendingError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/RemotePairing") {}

const mutationLock = Semaphore.makeUnsafe(1)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    type Store = typeof db
    type Transaction = Parameters<Parameters<Store["transaction"]>[0]>[0]
    type Connection = Store | Transaction

    const load = Effect.fn("RemotePairing.load")(function* (connection: Connection) {
      const row = yield* connection
        .select()
        .from(CredentialTable)
        .where(eq(CredentialTable.integration_id, remotePairingIntegrationID))
        .orderBy(asc(CredentialTable.time_created))
        .get()
        .pipe(Effect.orDie)
      if (!row || !row.integration_id) return { credential: undefined, store: emptyStore() }
      const stored = new Credential.Stored({
        id: row.id,
        integrationID: row.integration_id,
        label: row.label,
        value: decodeCredential(row.value),
      })
      if (stored.value.type !== "key") return { credential: stored, store: emptyStore() }
      return { credential: stored, store: decodePairingStore(stored.value.key) }
    })

    const save = Effect.fn("RemotePairing.save")(function* (
      connection: Connection,
      stored: typeof Credential.Stored.Type | undefined,
      store: PairingStore,
    ) {
      if (store.scopes.length === 0) {
        yield* connection
          .delete(CredentialTable)
          .where(eq(CredentialTable.integration_id, remotePairingIntegrationID))
          .run()
          .pipe(Effect.orDie)
        return
      }
      const value = new Credential.Key({
        type: "key",
        key: JSON.stringify(store),
      })
      if (stored) {
        yield* connection
          .update(CredentialTable)
          .set({ label: "remote-pairings", value })
          .where(eq(CredentialTable.id, stored.id))
          .run()
          .pipe(Effect.orDie)
        return
      }
      yield* connection
        .delete(CredentialTable)
        .where(eq(CredentialTable.integration_id, remotePairingIntegrationID))
        .run()
        .pipe(Effect.orDie)
      yield* connection
        .insert(CredentialTable)
        .values({
          id: Credential.ID.create(),
          integration_id: remotePairingIntegrationID,
          label: "remote-pairings",
          value,
        })
        .run()
        .pipe(Effect.orDie)
    })

    const atomic = Effect.fn("RemotePairing.atomic")(function* <A, E>(
      effect: (connection: Transaction) => Effect.Effect<A, E>,
    ) {
      // The process-local lane avoids needless contention, while IMMEDIATE
      // makes the read/modify/write transaction serialize with other SlopCode
      // processes sharing this SQLite database.
      return yield* db
        .transaction(effect, { behavior: "immediate" })
        .pipe(Effect.catchTag("SqlError", (error) => Effect.die(error)))
    })

    const hosts = Effect.fn("RemotePairing.hosts")(function* (scope: PairingScope) {
      const state = findScope((yield* load(db)).store, scope)
      if (!state) return []
      const grouped = new Map<string, Array<typeof RemotePairingRecord.Type>>()
      for (const pairing of state.pairings) {
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

    const create = Effect.fn("RemotePairing.create")(function* (
      input: typeof RemotePairingCreateInput.Type,
      scope: PairingScope,
    ) {
      return yield* mutationLock.withPermit(
        atomic((connection) =>
          Effect.gen(function* () {
            const stored = yield* load(connection)
            const current = findScope(stored.store, scope) ?? emptyScope(scope)
            const existing = current.pairings.find(
              (pairing) => pairing.device.id === input.device.id && sameWorkspace(pairing.workspace, input.workspace),
            )
            const code = pairingCode()
            const next = decodeRemotePairing({
              version: "v1",
              id: existing?.id ?? pairingID(),
              code,
              selection: {
                nonce: selectionNonce(),
                deviceID: input.device.id,
                code,
              },
              device: Schema.decodeUnknownSync(RemoteDevice)(input.device),
              host: existing?.host ?? host(input.workspace.mode),
              workspace: decodeRemoteWorkspace(input.workspace),
              capability: input.capability ?? capability(input.workspace.mode),
            })
            const selectedPairingID = current.selectedPairingID === next.id ? next.id : current.selectedPairingID
            yield* save(
              connection,
              stored.credential,
              putScope(stored.store, {
                ...current,
                pairings: [...current.pairings.filter((pairing) => pairing.id !== next.id), next],
                selectedPairingID,
              }),
            )
            return next
          }),
        ),
      )
    })

    const revoke = Effect.fn("RemotePairing.revoke")(function* (
      pairingID: typeof RemotePairingID.Type,
      scope: PairingScope,
    ) {
      return yield* mutationLock.withPermit(
        atomic((connection) =>
          Effect.gen(function* () {
            const stored = yield* load(connection)
            const current = findScope(stored.store, scope)
            if (!current) return false
            const pairings = current.pairings.filter((pairing) => pairing.id !== pairingID)
            if (pairings.length === current.pairings.length) return false
            yield* save(
              connection,
              stored.credential,
              putScope(stored.store, {
                ...current,
                pairings,
                targets: current.targets.filter((target) => target.pairingID !== pairingID),
                selectedPairingID: current.selectedPairingID === pairingID ? undefined : current.selectedPairingID,
              }),
            )
            return true
          }),
        ),
      )
    })

    const registerTarget = Effect.fn("RemotePairing.registerTarget")(function* (
      input: typeof RemoteWorkspaceTargetInput.Type,
      scope: PairingScope,
    ) {
      return yield* mutationLock.withPermit(
        atomic((connection) =>
          Effect.gen(function* () {
            if (!input.pairingID) {
              return yield* new TargetRegistrationError({
                message: "Remote target registration requires an exact pairing ID",
              })
            }
            const stored = yield* load(connection)
            const current = findScope(stored.store, scope)
            if (!current) {
              return yield* new TargetRegistrationError({
                message: `Remote pairing not found: ${input.pairingID}`,
              })
            }
            const pairing = current.pairings.find((item) => item.id === input.pairingID)
            if (!pairing) {
              return yield* new TargetRegistrationError({
                message: `Remote pairing not found: ${input.pairingID}`,
              })
            }
            if (!sameWorkspace(pairing.workspace, input.workspace)) {
              return yield* new TargetRegistrationError({
                message: "Registered remote target must match the exact paired workspace selection",
              })
            }
            const target = Schema.decodeUnknownSync(RemoteTarget)(input.target)
            const next: ScopeState = {
              ...current,
              targets: [
                ...current.targets.filter(
                  (item) =>
                    !(
                      item.pairingID === pairing.id &&
                      item.hostID === pairing.host.id &&
                      sameWorkspace(item.workspace, pairing.workspace)
                    ),
                ),
                {
                  pairingID: pairing.id,
                  hostID: pairing.host.id,
                  workspace: pairing.workspace,
                  target,
                },
              ],
            }
            yield* save(connection, stored.credential, putScope(stored.store, next))
          }),
        ),
      )
    })

    const select = Effect.fn("RemotePairing.select")(function* (
      input: typeof RemoteWorkspaceSelectInput.Type,
      scope: PairingScope,
    ) {
      return yield* mutationLock.withPermit(
        atomic((connection) =>
          Effect.gen(function* () {
            const stored = yield* load(connection)
            const current = findScope(stored.store, scope)
            const pairing = current?.pairings.find((item) => item.id === input.pairingID)
            if (!pairing || !current) {
              return yield* new SelectionUnavailableError({
                message: "Remote pairing selection is invalid, expired, or already used",
              })
            }
            const selection = pairing.selection
            if (
              !selection ||
              selection.deviceID !== pairing.device.id ||
              input.deviceID !== pairing.device.id ||
              input.selectionNonce !== selection.nonce ||
              input.selectionCode !== selection.code
            ) {
              return yield* new SelectionUnavailableError({
                message: "Remote pairing selection is invalid, expired, or already used",
              })
            }
            const target = requireRegisteredTarget(pairing, current)
            if (target instanceof TargetUnavailableError) return yield* target
            const consumed = decodeStoredPairing({ ...pairing, selection: undefined })
            yield* save(
              connection,
              stored.credential,
              putScope(stored.store, {
                ...current,
                pairings: current.pairings.map((item) => (item.id === pairing.id ? consumed : item)),
                selectedPairingID: pairing.id,
              }),
            )
            return redact(pairing)
          }),
        ),
      )
    })

    const target = Effect.fn("RemotePairing.target")(function* (workspaceID: WorkspaceID, scope: PairingScope) {
      const state = findScope((yield* load(db)).store, scope)
      const pairing = state?.selectedPairingID
        ? state.pairings.find((item) => item.id === state.selectedPairingID)
        : undefined
      if (!state || !pairing || pairing.workspace.id !== workspaceID) return undefined
      const active = requireRegisteredTarget(pairing, state)
      if (active instanceof TargetUnavailableError) return yield* active
      return { pairing: redact(pairing), target: active }
    })

    const validateSsh = Effect.fn("RemotePairing.validateSsh")(function* (
      workspace: typeof RemoteWorkspaceSsh.Type,
      scope: PairingScope,
    ) {
      decodeRemoteWorkspaceSsh(workspace)
      const state = findScope((yield* load(db)).store, scope)
      const pairing = state?.pairings.find(
        (item) =>
          sameWorkspace(item.workspace, workspace) &&
          !(requireRegisteredTarget(item, state) instanceof TargetUnavailableError),
      )
      if (pairing) return workspace
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

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
