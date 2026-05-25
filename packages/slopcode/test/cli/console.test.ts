import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

type AccountInfo = {
  id: string
  email: string
  url: string
  active_org_id: string | null
}

type AccountGroup = {
  account: AccountInfo
  orgs: Array<{ id: string; name: string }>
}

type AccountApi = {
  login: (url: string) => Promise<{
    code: string
    user: string
    url: string
    server: string
    expiry: number
    interval: number
  }>
  poll: (input: unknown) => Promise<{ type: string; email?: string; cause?: string }>
  list: () => AccountInfo[]
  active: () => AccountInfo | undefined
  remove: (accountID: string) => void
  use: (accountID: string, orgID?: string) => void
  orgsByAccount: () => Promise<AccountGroup[]>
}

const openCalls: string[] = []
const introCalls: string[] = []
const outroCalls: string[] = []
const infoCalls: string[] = []
const printed: string[] = []
const spinnerStarts: string[] = []
const spinnerStops: Array<[string, number | undefined]> = []
let selectValue = ""

const row = (value: Partial<AccountInfo> = {}): AccountInfo => ({
  id: "acc-1",
  email: "dev@example.com",
  url: "https://console.example.com",
  active_org_id: null,
  ...value,
})

mock.module("open", () => ({
  default: async (url: string) => {
    openCalls.push(url)
  },
}))

mock.module("@clack/prompts", () => ({
  intro: (msg: string) => introCalls.push(msg),
  outro: (msg: string) => outroCalls.push(msg),
  isCancel: () => false,
  select: async () => selectValue,
  spinner: () => ({
    start: (msg: string) => spinnerStarts.push(msg),
    stop: (msg: string, code?: number) => spinnerStops.push([msg, code]),
  }),
  log: {
    info: (msg: string) => infoCalls.push(msg),
    error: () => {},
    success: () => {},
    warn: () => {},
  },
}))

const consoleModule = await import("../../src/cli/cmd/console")
const accountModule = await import("../../src/account")
const uiModule = await import("../../src/cli/ui")

const {
  ConsoleLoginCommand,
  ConsoleLogoutCommand,
  ConsoleListCommand,
  ConsoleSwitchCommand,
  ConsoleOrgsCommand,
  ConsoleOpenCommand,
} = consoleModule
const Account = accountModule.Account as unknown as AccountApi
const { UI } = uiModule

const original = {
  login: Account.login,
  poll: Account.poll,
  list: Account.list,
  active: Account.active,
  remove: Account.remove,
  use: Account.use,
  orgsByAccount: Account.orgsByAccount,
  empty: UI.empty,
  println: UI.println,
}

beforeEach(() => {
  openCalls.length = 0
  introCalls.length = 0
  outroCalls.length = 0
  infoCalls.length = 0
  printed.length = 0
  spinnerStarts.length = 0
  spinnerStops.length = 0
  selectValue = ""

  Account.login = original.login
  Account.poll = original.poll
  Account.list = original.list
  Account.active = original.active
  Account.remove = original.remove
  Account.use = original.use
  Account.orgsByAccount = original.orgsByAccount
  UI.empty = mock(() => {}) as typeof UI.empty
  UI.println = mock((msg: string) => printed.push(msg)) as typeof UI.println
})

afterEach(() => {
  Account.login = original.login
  Account.poll = original.poll
  Account.list = original.list
  Account.active = original.active
  Account.remove = original.remove
  Account.use = original.use
  Account.orgsByAccount = original.orgsByAccount
  UI.empty = original.empty
  UI.println = original.println
})

describe("console CLI commands", () => {
  test("login opens browser and completes device flow", async () => {
    Account.login = mock(async (_url: string) => ({
      code: "code",
      user: "USER-CODE",
      url: "https://console.example.com/verify",
      server: "https://console.example.com",
      expiry: Date.now() + 1_000,
      interval: 0,
    }))
    Account.poll = mock(async (_input: unknown) => ({ type: "success", email: "dev@example.com" }))

    await ConsoleLoginCommand.handler({ url: "https://console.example.com" } as never)

    expect(infoCalls).toContain("Go to: https://console.example.com/verify")
    expect(infoCalls).toContain("Enter code: USER-CODE")
    expect(openCalls).toEqual(["https://console.example.com/verify"])
    expect(spinnerStarts).toEqual(["Waiting for authorization..."])
    expect(spinnerStops).toEqual([["Logged in as dev@example.com", undefined]])
    expect(outroCalls).toEqual(["Done"])
  })

  test("logout removes the requested account", async () => {
    const remove = mock(() => {})
    Account.list = () => [row(), row({ id: "acc-2", email: "other@example.com", url: "https://other.example.com" })]
    Account.active = () => row()
    Account.remove = remove

    await ConsoleLogoutCommand.handler({ email: "other@example.com" } as never)

    expect(remove).toHaveBeenCalledWith("acc-2")
    expect(outroCalls).toEqual(["Logged out from other@example.com"])
  })

  test("list shows the active org under the active account", async () => {
    Account.active = () => row({ active_org_id: "org-1" })
    Account.orgsByAccount = async () => [
      {
        account: row({ active_org_id: "org-1" }),
        orgs: [{ id: "org-1", name: "Acme" }],
      },
    ]

    await ConsoleListCommand.handler({} as never)

    expect(printed).toHaveLength(2)
    expect(printed[0]).toContain("dev@example.com")
    expect(printed[1]).toContain("Acme")
  })

  test("switch selects an org and updates active account state", async () => {
    selectValue = "acc-1\u0000org-1"
    Account.active = () => row()
    Account.orgsByAccount = async () => [
      {
        account: row(),
        orgs: [{ id: "org-1", name: "Acme" }],
      },
    ]
    Account.use = mock((_accountID: string, _orgID?: string) => {})

    await ConsoleSwitchCommand.handler({} as never)

    expect(Account.use).toHaveBeenCalledWith("acc-1", "org-1")
    expect(outroCalls).toEqual(["Switched to Acme"])
  })

  test("switch can activate an account without orgs", async () => {
    selectValue = "acc-2\u0000"
    Account.orgsByAccount = async () => [
      {
        account: row({ id: "acc-2", email: "solo@example.com", url: "https://solo.example.com" }),
        orgs: [],
      },
    ]
    Account.use = mock((_accountID: string, _orgID?: string) => {})

    await ConsoleSwitchCommand.handler({} as never)

    expect(Account.use).toHaveBeenCalledWith("acc-2", undefined)
    expect(outroCalls).toEqual(["Switched to solo@example.com"])
  })

  test("orgs prints available orgs with active marker", async () => {
    Account.active = () => row({ active_org_id: "org-1" })
    Account.orgsByAccount = async () => [
      {
        account: row({ active_org_id: "org-1" }),
        orgs: [{ id: "org-1", name: "Acme" }],
      },
    ]

    await ConsoleOrgsCommand.handler({} as never)

    expect(printed).toHaveLength(1)
    expect(printed[0]).toContain("Acme")
    expect(printed[0]).toContain("org-1")
  })

  test("open uses the active account url", async () => {
    Account.active = () => row({ url: "https://active.example.com" })

    await ConsoleOpenCommand.handler({} as never)

    expect(openCalls).toEqual(["https://active.example.com"])
    expect(outroCalls).toEqual(["Opened https://active.example.com"])
  })
})
