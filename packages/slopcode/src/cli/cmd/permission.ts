import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { InstanceState } from "@/effect/instance-state"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { Effect } from "effect"
import { EOL } from "os"
import { effectCmd, fail } from "../effect-cmd"
import { cmd } from "./cmd"

function table(items: ReadonlyArray<PermissionSaved.Info>) {
  if (!items.length) return "No saved permissions for this project."
  const widths = {
    id: Math.max("ID".length, ...items.map((item) => item.id.length)),
    action: Math.max("Permission".length, ...items.map((item) => item.action.length)),
  }
  return [
    `${"ID".padEnd(widths.id)}  ${"Permission".padEnd(widths.action)}  Resource`,
    `${"-".repeat(widths.id)}  ${"-".repeat(widths.action)}  ${"-".repeat("Resource".length)}`,
    ...items.map((item) => `${item.id.padEnd(widths.id)}  ${item.action.padEnd(widths.action)}  ${item.resource}`),
  ].join(EOL)
}

const projectID = InstanceState.context.pipe(
  Effect.map((ctx) =>
    ctx.project.id === ProjectV2.ID.global || ctx.project.vcs !== "git" ? undefined : ctx.project.id,
  ),
)
const unavailable = "Saved permissions are unavailable outside a Git project."

const ListCommand = effectCmd({
  command: "list",
  describe: "list saved Always approvals for this project",
  builder: (yargs) => yargs.option("json", { type: "boolean", describe: "output JSON" }),
  handler: Effect.fn("Cli.permission.list")(function* (args) {
    const project = yield* projectID
    if (!project) {
      process.stdout.write((args.json ? "[]" : unavailable) + EOL)
      return
    }
    const items = (yield* (yield* PermissionSaved.Service).list({ projectID: project })).toSorted((a, b) =>
      a.id.localeCompare(b.id),
    )
    process.stdout.write((args.json ? JSON.stringify(items, null, 2) : table(items)) + EOL)
  }),
})

const RevokeCommand = effectCmd({
  command: "revoke <id>",
  describe: "revoke a saved Always approval for this project",
  builder: (yargs) =>
    yargs.positional("id", {
      describe: "saved permission ID",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.permission.revoke")(function* (args) {
    const project = yield* projectID
    if (!project) return yield* fail(unavailable)
    const id = PermissionSaved.ID.make(args.id)
    const removed = yield* (yield* PermissionSaved.Service).remove({ id, projectID: project })
    if (!removed) yield* fail(`Saved permission not found in this project: ${id}`)
    process.stdout.write(`Revoked saved permission ${id}.` + EOL)
    return undefined
  }),
})

const ClearCommand = effectCmd({
  command: "clear",
  describe: "clear all saved Always approvals for this project",
  builder: (yargs) =>
    yargs.option("all", {
      type: "boolean",
      describe: "confirm clearing every saved permission",
    }),
  handler: Effect.fn("Cli.permission.clear")(function* (args) {
    if (!args.all) yield* fail("Pass --all to clear saved permissions.")
    const project = yield* projectID
    if (!project) {
      process.stdout.write(unavailable + EOL)
      return
    }
    const removed = yield* (yield* PermissionSaved.Service).clear(project)
    process.stdout.write(`Cleared ${removed} saved permission${removed === 1 ? "" : "s"}.` + EOL)
  }),
})

export const PermissionCommand = cmd({
  command: "permission",
  describe: "manage saved permissions",
  builder: (yargs) => yargs.command(ListCommand).command(RevokeCommand).command(ClearCommand).demandCommand(),
  async handler() {},
})
