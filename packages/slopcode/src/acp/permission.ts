import type { AgentSideConnection, PermissionOption, RequestPermissionResponse } from "@agentclientprotocol/sdk"
import type { Event, PermissionRequest, SlopcodeClient } from "@slopcode-ai/sdk/v2"
import { applyPatch } from "diff"
import { exists, readText } from "@/util/filesystem"
import type { ACPSession } from "./session"
import { toLocations, toToolKind, type ToolInput } from "./tool"
import { Effect } from "effect"

type PermissionEvent = Extract<Event, { type: "permission.asked" }>
type Reply = "once" | "always" | "project" | "reject"
type Scope = "project" | "folder"
type Connection = Partial<Pick<AgentSideConnection, "requestPermission" | "writeTextFile">>
type Batch = {
  expected: number
  events: Map<string, PermissionEvent>
  sessionID: string
  processing: boolean
  decision?: { requestIDs: string[]; reply: Reply; edits: PermissionEvent[] }
}

const base: PermissionOption[] = [
  { optionId: "once", kind: "allow_once", name: "Allow once" },
  { optionId: "reject", kind: "reject_once", name: "Reject" },
]

function options(scope: Scope, patterns: string[]): PermissionOption[] {
  if (!patterns.length) return base
  return [
    base[0]!,
    { optionId: "always", kind: "allow_always", name: "Allow for this session" },
    { optionId: "project", kind: "allow_always", name: `Always allow for this ${scope}` },
    base[1]!,
  ]
}

export class Handler {
  private readonly queues = new Map<string, Promise<void>>()
  private readonly batches = new Map<string, Batch>()

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
        processing: false,
      }
      batch.expected = Math.max(batch.expected, permission.batchSize ?? 1)
      batch.events.set(permission.id, event)
      this.batches.set(permission.batchID, batch)
      if (batch.events.size < batch.expected || batch.processing) return
      batch.processing = true
      this.enqueue(permission.sessionID, async () => {
        try {
          await this.processBatch(permission.batchID!, batch)
          if (this.batches.get(permission.batchID!) === batch) this.batches.delete(permission.batchID!)
        } catch {
          if (this.batches.get(permission.batchID!) === batch) batch.processing = false
        }
      })
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
    const reply = await this.choose(permission, session.cwd)
    if (reply !== "reject" && permission.permission === "edit") {
      await this.writeProposedEdit(session.id, permission.metadata).catch(() => {})
    }
    await this.reply(permission.id, reply, session.cwd)
  }

  private async processBatch(batchID: string, batch: Batch) {
    const events = [...batch.events.values()].toSorted((a, b) => a.properties.id.localeCompare(b.properties.id))
    const first = events[0]?.properties
    if (!first) return
    const session = await Effect.runPromise(this.input.session.tryGet(first.sessionID))
    if (!session) return
    if (!batch.decision) {
      const selected: string[] = []
      const replies: Reply[] = []
      const edits: PermissionEvent[] = []
      for (const event of events) {
        const reply = await this.choose(event.properties, session.cwd)
        if (reply === "reject") continue
        selected.push(event.properties.id)
        replies.push(reply)
        if (event.properties.permission === "edit") edits.push(event)
      }
      const mixed = replies.some((reply) => reply !== replies[0])
      batch.decision = {
        requestIDs: mixed ? [] : selected,
        reply: !selected.length || mixed ? "reject" : replies[0]!,
        edits: mixed ? [] : edits,
      }
    }
    const result = await this.input.sdk.permission.replyBatch({
      batchID,
      requestIDs: batch.decision.requestIDs,
      reply: batch.decision.reply,
      directory: session.cwd,
    })
    if ("error" in result && result.error) throw new Error("Forecast batch reply failed")
    for (const event of batch.decision.edits)
      await this.writeProposedEdit(session.id, event.properties.metadata).catch(() => {})
  }

  private async choose(permission: PermissionRequest, directory: string): Promise<Reply> {
    if (!this.input.connection.requestPermission) return "reject"
    const scope = permission.always.length
      ? await this.input.sdk.project
          .current({ directory })
          .then((result) => (result.data?.vcs === "git" ? ("project" as const) : ("folder" as const)))
          .catch(() => "folder" as const)
      : "folder"
    const result = await this.request(permission, options(scope, permission.always)).catch(() => undefined)
    if (!result || result.outcome.outcome !== "selected") return "reject"
    if (result.outcome.optionId === "once") return "once"
    if (result.outcome.optionId === "always" && permission.always.length) return "always"
    if (result.outcome.optionId !== "project" || !permission.always.length) return "reject"
    return (await this.confirm(permission, scope)) ? "project" : "reject"
  }

  private async confirm(permission: PermissionRequest, scope: Scope) {
    const result = await this.request(
      permission,
      [
        { optionId: "confirm", kind: "allow_always", name: "Confirm" },
        { optionId: "cancel", kind: "reject_once", name: "Cancel" },
      ],
      {
        title: `Always allow for this ${scope}?`,
        rawInput: {
          lifetime: "Survives restarts until revoked.",
          exactPatterns: permission.always,
        },
      },
    ).catch(() => undefined)
    return result?.outcome.outcome === "selected" && result.outcome.optionId === "confirm"
  }

  private request(
    permission: PermissionRequest,
    options: PermissionOption[],
    detail?: { title: string; rawInput: Record<string, unknown> },
  ) {
    return this.input.connection.requestPermission!({
      sessionId: permission.sessionID,
      toolCall: {
        toolCallId: permission.tool?.callID ?? permission.id,
        status: "pending",
        title: detail?.title ?? permission.permission,
        rawInput: detail?.rawInput ?? permission.metadata,
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
