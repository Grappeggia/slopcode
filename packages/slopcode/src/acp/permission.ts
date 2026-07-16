import type { AgentSideConnection, PermissionOption, RequestPermissionResponse } from "@agentclientprotocol/sdk"
import type { Event, PermissionRequest, SlopcodeClient } from "@slopcode-ai/sdk/v2"
import { applyPatch } from "diff"
import { exists, readText } from "@/util/filesystem"
import type { ACPSession } from "./session"
import { toLocations, toToolKind, type ToolInput } from "./tool"
import { Effect } from "effect"

type PermissionEvent = Extract<Event, { type: "permission.asked" }>
type Reply = "once" | "session" | "global" | "reject"
type Connection = Partial<Pick<AgentSideConnection, "requestPermission" | "writeTextFile">>

const base: PermissionOption[] = [
  { optionId: "once", kind: "allow_once", name: "Allow once" },
  { optionId: "reject", kind: "reject_once", name: "Reject" },
]
const session = { optionId: "session", kind: "allow_always", name: "Allow for this session" } as const
const global = { optionId: "global", kind: "allow_always", name: "Remember globally" } as const
const confirm: PermissionOption[] = [
  { optionId: "confirm_global", kind: "allow_always", name: "Confirm global access" },
  { optionId: "cancel_global", kind: "reject_once", name: "Cancel" },
]

export class Handler {
  private readonly queues = new Map<string, Promise<void>>()
  private readonly batches = new Map<
    string,
    { expected: number; events: Map<string, PermissionEvent>; sessionID: string }
  >()

  constructor(
    private readonly input: {
      sdk: SlopcodeClient
      connection: Connection
      session: ACPSession.Interface
    },
  ) {}

  handle(event: PermissionEvent) {
    const permission = event.properties
    if (permission.kind === "forecast" && permission.batchID) {
      const batch = this.batches.get(permission.batchID) ?? {
        expected: permission.batchSize ?? 1,
        events: new Map<string, PermissionEvent>(),
        sessionID: permission.sessionID,
      }
      batch.expected = Math.max(batch.expected, permission.batchSize ?? 1)
      batch.events.set(permission.id, event)
      this.batches.set(permission.batchID, batch)
      if (batch.events.size < batch.expected) return
      this.batches.delete(permission.batchID)
      this.enqueue(permission.sessionID, () =>
        this.processBatch(
          permission.batchID!,
          [...batch.events.values()].toSorted((a, b) => a.properties.id.localeCompare(b.properties.id)),
        ),
      )
      return
    }
    this.enqueue(permission.sessionID, () => this.process(event))
  }

  private enqueue(sessionID: string, run: () => Promise<void>) {
    const previous = this.queues.get(sessionID) ?? Promise.resolve()
    const next = previous
      .then(run)
      .catch(() => {})
      .finally(() => {
        if (this.queues.get(sessionID) === next) this.queues.delete(sessionID)
      })
    this.queues.set(sessionID, next)
  }

  private async process(event: PermissionEvent) {
    const permission = event.properties
    const session = await Effect.runPromise(this.input.session.tryGet(permission.sessionID))
    if (!session) return
    const reply = await this.choose(permission)
    if (reply !== "reject" && permission.permission === "edit") {
      await this.writeProposedEdit(session.id, permission.metadata).catch(() => {})
    }
    await this.reply(permission.id, reply, session.cwd)
  }

  private async processBatch(batchID: string, events: PermissionEvent[]) {
    const first = events[0]?.properties
    if (!first) return
    const session = await Effect.runPromise(this.input.session.tryGet(first.sessionID))
    if (!session) return
    const selected: string[] = []
    const replies: Reply[] = []
    for (const event of events) {
      const reply = await this.choose(event.properties)
      if (reply === "reject") continue
      selected.push(event.properties.id)
      replies.push(reply)
      if (event.properties.permission === "edit")
        await this.writeProposedEdit(session.id, event.properties.metadata).catch(() => {})
    }
    const reply = replies.length && replies.every((item) => item === replies[0]) ? replies[0]! : "once"
    await this.input.sdk.permission.replyBatch({
      batchID,
      requestIDs: selected,
      reply: selected.length ? reply : "reject",
      directory: session.cwd,
    })
  }

  private async choose(permission: PermissionRequest): Promise<Reply> {
    if (!this.input.connection.requestPermission) return "reject"
    const scopes = permission.grant?.resources.length ? (permission.grant.scopes ?? []) : []
    const options = [
      base[0]!,
      ...(scopes.includes("session") ? [session] : []),
      ...(scopes.includes("global") ? [global] : []),
      base[1]!,
    ]
    const result = await this.request(permission, options).catch(() => undefined)
    if (!result || result.outcome.outcome !== "selected") return "reject"
    if (result.outcome.optionId === "once") return "once"
    if (result.outcome.optionId === "session" && scopes.includes("session")) return "session"
    if (result.outcome.optionId !== "global" || !scopes.includes("global")) return "reject"
    const confirmation = await this.request(permission, confirm).catch(() => undefined)
    if (confirmation?.outcome.outcome !== "selected" || confirmation.outcome.optionId !== "confirm_global")
      return "reject"
    return "global"
  }

  private request(permission: PermissionRequest, options: PermissionOption[]) {
    return this.input.connection.requestPermission!({
      sessionId: permission.sessionID,
      toolCall: {
        toolCallId: permission.tool?.callID ?? permission.id,
        status: "pending",
        title: permission.permission,
        rawInput: permission.metadata,
        kind: toToolKind(permission.permission),
        locations: toLocations(permission.permission, permission.metadata),
      },
      options,
    })
  }

  private async reply(requestID: string, reply: Reply, directory: string) {
    await this.input.sdk.permission.reply({ requestID, reply, directory })
  }

  private async writeProposedEdit(sessionId: string, metadata: ToolInput) {
    const filepath = stringValue(metadata.filepath)
    const diff = stringValue(metadata.diff)
    if (!filepath || !diff || !this.input.connection.writeTextFile) return

    const content = (await exists(filepath)) ? await readText(filepath) : ""
    const next = applyPatch(content, diff)
    if (next === false) return
    void this.input.connection.writeTextFile({ sessionId, path: filepath, content: next })
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined
}

export * as ACPPermission from "./permission"
