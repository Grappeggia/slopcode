import * as prompts from "@clack/prompts"
import open from "open"
import { setTimeout as sleep } from "node:timers/promises"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Account } from "@/account"

const dim = (value: string) => UI.Style.TEXT_DIM + value + UI.Style.TEXT_NORMAL
const activeSuffix = (value: boolean) => (value ? dim(" (active)") : "")

const accountLabel = (account: { email: string; url: string }, active: boolean) =>
  `${account.email} ${dim(account.url)}${activeSuffix(active)}`

const orgLabel = (account: { email: string }, org: { name: string }, active: boolean) =>
  `${org.name} (${account.email})${activeSuffix(active)}`

const orgLine = (account: { email: string; url: string }, org: { id: string; name: string }, active: boolean) => {
  const dot = active ? UI.Style.TEXT_SUCCESS + "*" + UI.Style.TEXT_NORMAL : " "
  const name = active ? UI.Style.TEXT_HIGHLIGHT_BOLD + org.name + UI.Style.TEXT_NORMAL : org.name
  return `  ${dot} ${name} ${dim(account.email)} ${dim(account.url)} ${dim(org.id)}`
}

const openBrowser = (url: string) => open(url).catch(() => undefined)

async function login(url: string) {
  const flow = await Account.login(url)
  prompts.log.info("Go to: " + flow.url)
  prompts.log.info("Enter code: " + flow.user)
  openBrowser(flow.url)

  const spinner = prompts.spinner()
  spinner.start("Waiting for authorization...")

  let wait = flow.interval
  while (Date.now() < flow.expiry) {
    await sleep(wait)
    const result = await Account.poll(flow)
    if (result.type === "pending") continue
    if (result.type === "slow") {
      wait += 5000
      continue
    }
    if (result.type === "success") {
      spinner.stop("Logged in as " + result.email)
      prompts.outro("Done")
      return
    }
    if (result.type === "expired") {
      spinner.stop("Device code expired", 1)
      return
    }
    if (result.type === "denied") {
      spinner.stop("Authorization denied", 1)
      return
    }
    spinner.stop("Error: " + result.cause, 1)
    return
  }

  spinner.stop("Device code expired", 1)
}

async function list() {
  const rows = await Account.orgsByAccount()
  if (rows.length === 0) {
    UI.println("No accounts found")
    return
  }

  const active = Account.active()
  for (const row of rows) {
    const isActive = active?.id === row.account.id
    const dot = isActive ? UI.Style.TEXT_SUCCESS + "*" + UI.Style.TEXT_NORMAL : " "
    UI.println(`  ${dot} ${accountLabel(row.account, isActive)}`)
    if (!isActive || !active?.active_org_id) continue
    const org = row.orgs.find((item) => item.id === active.active_org_id)
    if (!org) continue
    UI.println(`    ${dim("org")} ${org.name} ${dim(active.active_org_id)}`)
  }
}

async function selectAccount(email: string | undefined, message: string) {
  const rows = Account.list()
  if (rows.length === 0) {
    UI.println("No accounts found")
    return
  }

  const active = Account.active()
  const filtered = email ? rows.filter((row) => row.email === email) : rows
  if (filtered.length === 0) {
    UI.println("Account not found: " + email)
    return
  }

  if (filtered.length === 1) return filtered[0]
  const selected = await prompts.select({
    message,
    options: filtered.map((row) => ({
      value: row.id,
      label: accountLabel(row, active?.id === row.id),
    })),
  })
  if (prompts.isCancel(selected)) throw new UI.CancelledError()
  return filtered.find((row) => row.id === selected)
}

async function logout(email?: string) {
  const row = await selectAccount(email, "Select account to log out")
  if (!row) return
  Account.remove(row.id)
  prompts.outro("Logged out from " + row.email)
}

async function switchAccount(email?: string) {
  const groups = (await Account.orgsByAccount()).filter((group) => !email || group.account.email === email)
  if (groups.length === 0) {
    UI.println(email ? "Account not found: " + email : "No accounts found")
    return
  }

  const active = Account.active()
  const options = groups.flatMap((group) => {
    if (group.orgs.length === 0) {
      return [
        {
          value: `${group.account.id}\u0000`,
          label: accountLabel(group.account, active?.id === group.account.id && !active?.active_org_id),
          name: group.account.email,
        },
      ]
    }

    return group.orgs.map((org) => ({
      value: `${group.account.id}\u0000${org.id}`,
      label: orgLabel(group.account, org, active?.id === group.account.id && active.active_org_id === org.id),
      name: org.name,
    }))
  })
  if (options.length === 0) {
    UI.println("No accounts found")
    return
  }

  const selected = await prompts.select({
    message: options.some((item) => item.value.endsWith("\u0000")) ? "Select account or org" : "Select org",
    options,
  })
  if (prompts.isCancel(selected)) throw new UI.CancelledError()
  const [accountID, orgID] = selected.split("\u0000")
  const item = options.find((option) => option.value === selected)
  Account.use(accountID, orgID || undefined)
  prompts.outro("Switched to " + (item?.name ?? orgID ?? accountID))
}

async function listOrgs() {
  const groups = await Account.orgsByAccount()
  if (groups.length === 0) {
    UI.println("No accounts found")
    return
  }
  if (!groups.some((group) => group.orgs.length > 0)) {
    UI.println("No orgs found")
    return
  }

  const active = Account.active()
  for (const group of groups) {
    for (const org of group.orgs) {
      UI.println(orgLine(group.account, org, active?.id === group.account.id && active.active_org_id === org.id))
    }
  }
}

async function openAccount() {
  const row = Account.active() ?? Account.list()[0]
  if (!row) {
    UI.println("No accounts found")
    return
  }
  openBrowser(row.url)
  prompts.outro("Opened " + row.url)
}

export const ConsoleLoginCommand = cmd({
  command: "login <url>",
  describe: "log in to console",
  builder: (yargs) =>
    yargs.positional("url", {
      describe: "console server URL",
      type: "string",
      demandOption: true,
    }),
  async handler(args) {
    UI.empty()
    prompts.intro("Log in")
    await login(args.url)
  },
})

export const ConsoleLogoutCommand = cmd({
  command: "logout [email]",
  describe: "log out from console",
  builder: (yargs) =>
    yargs.positional("email", {
      describe: "account email to log out from",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    await logout(args.email)
  },
})

export const ConsoleListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list console accounts",
  async handler() {
    UI.empty()
    await list()
  },
})

export const ConsoleSwitchCommand = cmd({
  command: "switch [email]",
  describe: "switch active console account or org",
  builder: (yargs) =>
    yargs.positional("email", {
      describe: "account email to switch within",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    await switchAccount(args.email)
  },
})

export const ConsoleOrgsCommand = cmd({
  command: "orgs",
  describe: "list console orgs",
  async handler() {
    UI.empty()
    await listOrgs()
  },
})

export const ConsoleOpenCommand = cmd({
  command: "open",
  describe: "open active console account",
  async handler() {
    UI.empty()
    await openAccount()
  },
})

export const ConsoleCommand = cmd({
  command: "console",
  describe: "manage console accounts",
  builder: (yargs) =>
    yargs
      .command(ConsoleLoginCommand)
      .command(ConsoleLogoutCommand)
      .command(ConsoleListCommand)
      .command(ConsoleSwitchCommand)
      .command(ConsoleOrgsCommand)
      .command(ConsoleOpenCommand)
      .demandCommand(),
  async handler() {},
})
