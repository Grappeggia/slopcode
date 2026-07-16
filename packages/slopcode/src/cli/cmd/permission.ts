import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { InstanceState } from "@/effect/instance-state"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { Effect } from "effect"
import { EOL } from "os"
import { effectCmd, fail } from "../effect-cmd"
import { cmd } from "./cmd"
import type { Argv } from "yargs"

function table(items: ReadonlyArray<PermissionSaved.Info>) {
  if (!items.length) return "No saved permissions in this scope."
  const widths = {
    id: Math.max("ID".length, ...items.map((item) => item.id.length)),
    scope: Math.max("Scope".length, ...items.map((item) => item.scope.length)),
    action: Math.max("Permission".length, ...items.map((item) => item.action.length)),
  }
  return [
    `${"ID".padEnd(widths.id)}  ${"Scope".padEnd(widths.scope)}  Match    ${"Permission".padEnd(widths.action)}  Resource`,
    `${"-".repeat(widths.id)}  ${"-".repeat(widths.scope)}  ${"-".repeat(7)}  ${"-".repeat(widths.action)}  ${"-".repeat(8)}`,
    ...items.map(
      (item) =>
        `${item.id.padEnd(widths.id)}  ${item.scope.padEnd(widths.scope)}  ${item.match.padEnd(7)}  ${item.action.padEnd(widths.action)}  ${item.resource}`,
    ),
  ].join(EOL)
}

const projectID = InstanceState.context.pipe(
  Effect.map((ctx) =>
    ctx.project.id === ProjectV2.ID.global || ctx.project.vcs !== "git" ? undefined : ctx.project.id,
  ),
)
const unavailable = "Project permissions are unavailable outside a Git project; use --scope global or --scope session."

function options(yargs: Argv) {
  return yargs
    .option("scope", {
      choices: ["project", "session", "global", "all"] as const,
      default: "project" as const,
      describe: "saved permission scope",
    })
    .option("session", { type: "string", describe: "session ID for session grants" })
    .option("project", { type: "string", describe: "project ID for legacy project grants" })
}

const ListCommand = effectCmd({
  command: "list",
  describe: "list saved permission grants",
  builder: (yargs) => options(yargs).option("json", { type: "boolean", describe: "output JSON" }),
  handler: Effect.fn("Cli.permission.list")(function* (args) {
    const saved = yield* PermissionSaved.Service
    const items = yield* Effect.gen(function* () {
      if (args.scope === "all") return yield* saved.list()
      if (args.scope === "global") return yield* saved.list({ scope: "global" })
      if (args.scope === "session") {
        if (!args.session) return yield* fail("Pass --session <id> for session permissions.")
        return yield* saved.list({ scope: "session", sessionID: SessionSchema.ID.make(args.session) })
      }
      const project = args.project ? ProjectV2.ID.make(args.project) : yield* projectID
      if (!project) {
        process.stdout.write((args.json ? "[]" : unavailable) + EOL)
        return undefined
      }
      return yield* saved.list({ scope: "project", projectID: project })
    })
    if (!items) return
    const sorted = items.toSorted((a, b) => a.id.localeCompare(b.id))
    process.stdout.write((args.json ? JSON.stringify(sorted, null, 2) : table(sorted)) + EOL)
  }),
})

const RevokeCommand = effectCmd({
  command: "revoke <id>",
  describe: "revoke a saved permission grant",
  builder: (yargs) =>
    options(yargs).positional("id", {
      describe: "saved permission ID",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.permission.revoke")(function* (args) {
    if (args.scope === "all") return yield* fail("Choose project, session, or global when revoking.")
    const saved = yield* PermissionSaved.Service
    const id = PermissionSaved.ID.make(args.id)
    const removed = yield* Effect.gen(function* () {
      if (args.scope === "global") return yield* saved.remove({ id, scope: "global" })
      if (args.scope === "session") {
        if (!args.session) return yield* fail("Pass --session <id> for session permissions.")
        return yield* saved.remove({ id, scope: "session", sessionID: SessionSchema.ID.make(args.session) })
      }
      const project = args.project ? ProjectV2.ID.make(args.project) : yield* projectID
      if (!project) return yield* fail(unavailable)
      return yield* saved.remove({ id, scope: "project", projectID: project })
    })
    if (!removed) yield* fail(`Saved permission not found in ${args.scope} scope: ${id}`)
    process.stdout.write(`Revoked saved permission ${id}.` + EOL)
  }),
})

const ClearCommand = effectCmd({
  command: "clear",
  describe: "clear one saved permission scope",
  builder: (yargs) =>
    options(yargs).option("all", {
      type: "boolean",
      describe: "confirm clearing every saved permission in the selected scope",
    }),
  handler: Effect.fn("Cli.permission.clear")(function* (args) {
    if (!args.all) yield* fail("Pass --all to clear saved permissions.")
    if (args.scope === "all") return yield* fail("Choose project, session, or global when clearing.")
    const saved = yield* PermissionSaved.Service
    const removed = yield* Effect.gen(function* () {
      if (args.scope === "global") return yield* saved.clear({ scope: "global" })
      if (args.scope === "session") {
        if (!args.session) return yield* fail("Pass --session <id> for session permissions.")
        return yield* saved.clear({ scope: "session", sessionID: SessionSchema.ID.make(args.session) })
      }
      const project = args.project ? ProjectV2.ID.make(args.project) : yield* projectID
      if (!project) return yield* fail(unavailable)
      return yield* saved.clear({ scope: "project", projectID: project })
    })
    process.stdout.write(`Cleared ${removed} saved permission${removed === 1 ? "" : "s"}.` + EOL)
  }),
})

export const PermissionCommand = cmd({
  command: "permission",
  describe: "manage saved permissions",
  builder: (yargs) => yargs.command(ListCommand).command(RevokeCommand).command(ClearCommand).demandCommand(),
  async handler() {},
})
