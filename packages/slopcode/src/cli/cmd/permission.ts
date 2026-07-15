import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { InstanceState } from "@/effect/instance-state"
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

const ListCommand = effectCmd({
  command: "list",
  describe: "list saved Always approvals for this project",
  builder: (yargs) => yargs.option("json", { type: "boolean", describe: "output JSON" }),
  handler: Effect.fn("Cli.permission.list")(function* (args) {
    const ctx = yield* InstanceState.context
    const items = (yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toSorted((a, b) =>
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
    const ctx = yield* InstanceState.context
    const id = PermissionSaved.ID.make(args.id)
    const removed = yield* (yield* PermissionSaved.Service).remove({ id, projectID: ctx.project.id })
    if (!removed) yield* fail(`Saved permission not found in this project: ${id}`)
    process.stdout.write(`Revoked saved permission ${id}.` + EOL)
  }),
})

const ClearCommand = effectCmd({
  command: "clear",
  describe: "clear all saved Always approvals for this project",
  builder: (yargs) =>
    yargs.option("all", {
      type: "boolean",
      demandOption: true,
      describe: "confirm clearing every saved permission",
    }),
  handler: Effect.fn("Cli.permission.clear")(function* (args) {
    if (!args.all) yield* fail("Pass --all to clear saved permissions.")
    const ctx = yield* InstanceState.context
    const removed = yield* (yield* PermissionSaved.Service).clear(ctx.project.id)
    process.stdout.write(`Cleared ${removed} saved permission${removed === 1 ? "" : "s"}.` + EOL)
  }),
})

export const PermissionCommand = cmd({
  command: "permission",
  describe: "manage saved permissions",
  builder: (yargs) => yargs.command(ListCommand).command(RevokeCommand).command(ClearCommand).demandCommand(),
  async handler() {},
})
