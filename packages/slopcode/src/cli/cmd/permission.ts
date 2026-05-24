import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { PermissionNext } from "../../permission/next"

function table(rules: PermissionNext.Ruleset) {
  if (rules.length === 0) return "No saved permissions for this project."
  const permission = Math.max("Permission".length, ...rules.map((rule) => rule.permission.length))
  const action = Math.max("Action".length, ...rules.map((rule) => rule.action.length))
  const lines = [
    `${"Permission".padEnd(permission)}  ${"Action".padEnd(action)}  Pattern`,
    `${"-".repeat(permission)}  ${"-".repeat(action)}  ${"-".repeat("Pattern".length)}`,
  ]
  return lines
    .concat(
      rules.map((rule) => `${rule.permission.padEnd(permission)}  ${rule.action.padEnd(action)}  ${rule.pattern}`),
    )
    .join(EOL)
}

const ListCommand = cmd({
  command: "list",
  describe: "list saved Always Allow permissions for this project",
  builder: (yargs: Argv) =>
    yargs.option("format", {
      describe: "output format",
      type: "string",
      choices: ["table", "json"],
      default: "table",
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rules = await PermissionNext.listApproved()
      console.log(args.format === "json" ? JSON.stringify(rules, null, 2) : table(rules))
    })
  },
})

const RevokeCommand = cmd({
  command: "revoke <permission> <pattern>",
  describe: "revoke a saved Always Allow permission for this project",
  builder: (yargs: Argv) =>
    yargs
      .positional("permission", {
        describe: "permission name",
        type: "string",
        demandOption: true,
      })
      .positional("pattern", {
        describe: "permission pattern",
        type: "string",
        demandOption: true,
      })
      .option("action", {
        describe: "permission action to revoke",
        type: "string",
        choices: ["allow", "ask", "deny"],
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const removed = await PermissionNext.removeApproved({
        permission: args.permission,
        pattern: args.pattern,
        action: PermissionNext.Action.optional().parse(args.action),
      })
      console.log(`Revoked ${removed} saved permission${removed === 1 ? "" : "s"}.`)
    })
  },
})

const ClearCommand = cmd({
  command: "clear",
  describe: "clear saved Always Allow permissions for this project",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const removed = await PermissionNext.clearApproved()
      console.log(`Cleared ${removed} saved permission${removed === 1 ? "" : "s"}.`)
    })
  },
})

export const PermissionCommand = cmd({
  command: "permission",
  describe: "manage saved permissions",
  builder: (yargs: Argv) => yargs.command(ListCommand).command(RevokeCommand).command(ClearCommand).demandCommand(),
  handler: () => {},
})
