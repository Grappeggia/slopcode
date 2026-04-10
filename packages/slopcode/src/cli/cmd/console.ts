import { and, eq } from "drizzle-orm"
import * as prompts from "@clack/prompts"
import open from "open"
import { setTimeout as sleep } from "node:timers/promises"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Database } from "../../storage/db"
import { ControlAccountTable } from "../../control/control.sql"

const clientID = "slopcode-cli"

type DeviceCode = {
  device_code: string
  user_code: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

type DeviceToken =
  | {
      access_token: string
      refresh_token: string
      expires_in?: number
    }
  | {
      error: string
      error_description?: string
    }

type User = {
  email: string
}

type Account = {
  email: string
  url: string
  active: boolean
}

async function login(url: string) {
  const server = url.replace(/\/+$/, "")
  const code = await fetch(`${server}/auth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientID }),
  }).then((x) => x.json() as Promise<DeviceCode>)

  const verify = code.verification_uri_complete.startsWith("http")
    ? code.verification_uri_complete
    : `${server}${code.verification_uri_complete}`

  prompts.log.info("Go to: " + verify)
  prompts.log.info("Enter code: " + code.user_code)
  open(verify).catch(() => {})

  const s = prompts.spinner()
  s.start("Waiting for authorization...")

  async function poll(wait: number): Promise<DeviceToken> {
    await sleep(wait * 1000)
    const result = await fetch(`${server}/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: code.device_code,
        client_id: clientID,
      }),
    }).then((x) => x.json() as Promise<DeviceToken>)

    if (!("error" in result)) return result
    if (result.error === "authorization_pending") return poll(wait)
    if (result.error === "slow_down") return poll(wait + 5)
    return result
  }

  const token = await poll(code.interval)
  if ("error" in token) {
    const message = token.error_description || token.error
    s.stop("Failed to authorize: " + message, 1)
    return
  }

  const user = await fetch(`${server}/api/user`, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
  }).then((x) => x.json() as Promise<User>)

  Database.use((db) => {
    db.update(ControlAccountTable).set({ active: false }).where(eq(ControlAccountTable.active, true)).run()
    db.insert(ControlAccountTable)
      .values({
        email: user.email,
        url: server,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expiry: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
        active: true,
      })
      .onConflictDoUpdate({
        target: [ControlAccountTable.email, ControlAccountTable.url],
        set: {
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          token_expiry: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
          active: true,
          time_updated: Date.now(),
        },
      })
      .run()
  })

  s.stop("Logged in as " + user.email)
  prompts.outro("Done")
}

function list() {
  const rows = Database.use((db) => db.select().from(ControlAccountTable).all())
  if (rows.length === 0) {
    UI.println("No accounts found")
    return
  }

  for (const row of rows) {
    const dot = row.active ? UI.Style.TEXT_SUCCESS + "*" + UI.Style.TEXT_NORMAL : " "
    const active = row.active ? UI.Style.TEXT_DIM + " (active)" + UI.Style.TEXT_NORMAL : ""
    UI.println(`  ${dot} ${row.email} ${UI.Style.TEXT_DIM}${row.url}${UI.Style.TEXT_NORMAL}${active}`)
  }
}

function options(rows: Account[]) {
  return rows.map((row) => ({
    value: `${row.email}\u0000${row.url}`,
    label: row.active
      ? `${row.email} ${UI.Style.TEXT_DIM}${row.url}${UI.Style.TEXT_NORMAL} (active)`
      : `${row.email} ${UI.Style.TEXT_DIM}${row.url}${UI.Style.TEXT_NORMAL}`,
  }))
}

async function select(email: string | undefined, message: string) {
  const rows = Database.use((db) => db.select().from(ControlAccountTable).all())
  if (rows.length === 0) {
    UI.println("No accounts found")
    return
  }

  const filtered = email ? options(rows).filter((x) => x.label.startsWith(email + " ")) : options(rows)
  if (filtered.length === 0) {
    UI.println("Account not found: " + email)
    return
  }

  const selected =
    filtered.length === 1
      ? filtered[0].value
      : await prompts.select({
          message,
          options: filtered,
        })
  if (prompts.isCancel(selected)) throw new UI.CancelledError()
  return selected.split("\u0000") as [string, string]
}

async function logout(email?: string) {
  const selected = await select(email, "Select account to log out")
  if (!selected) return

  const [user, url] = selected
  Database.use((db) => {
    const wasActive = db
      .select({ active: ControlAccountTable.active })
      .from(ControlAccountTable)
      .where(and(eq(ControlAccountTable.email, user), eq(ControlAccountTable.url, url)))
      .get()

    db.delete(ControlAccountTable)
      .where(and(eq(ControlAccountTable.email, user), eq(ControlAccountTable.url, url)))
      .run()

    if (!wasActive?.active) return
    const next = db.select().from(ControlAccountTable).get()
    if (!next) return
    db.update(ControlAccountTable)
      .set({ active: true })
      .where(and(eq(ControlAccountTable.email, next.email), eq(ControlAccountTable.url, next.url)))
      .run()
  })

  prompts.outro("Logged out from " + user)
}

async function switchAccount(email?: string) {
  const selected = await select(email, "Select active account")
  if (!selected) return

  const [user, url] = selected
  Database.use((db) => {
    db.update(ControlAccountTable).set({ active: false }).where(eq(ControlAccountTable.active, true)).run()
    db.update(ControlAccountTable)
      .set({ active: true })
      .where(and(eq(ControlAccountTable.email, user), eq(ControlAccountTable.url, url)))
      .run()
  })
  prompts.outro("Switched to " + user)
}

async function openAccount() {
  const row = Database.use((db) => {
    const active = db.select().from(ControlAccountTable).where(eq(ControlAccountTable.active, true)).get()
    if (active) return active
    return db.select().from(ControlAccountTable).get()
  })
  if (!row) {
    UI.println("No accounts found")
    return
  }
  open(row.url).catch(() => {})
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
    list()
  },
})

export const ConsoleSwitchCommand = cmd({
  command: "switch [email]",
  describe: "switch active console account",
  builder: (yargs) =>
    yargs.positional("email", {
      describe: "account email to switch to",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    await switchAccount(args.email)
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
      .command(ConsoleOpenCommand)
      .demandCommand(),
  async handler() {},
})
