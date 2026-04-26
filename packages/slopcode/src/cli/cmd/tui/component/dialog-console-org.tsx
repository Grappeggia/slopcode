import { createMemo, createResource } from "solid-js"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"

const host = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

type Org = {
  accountID: string
  accountEmail: string
  accountUrl: string
  orgID: string
  orgName: string
  active: boolean
}

export function DialogConsoleOrg() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()

  const console = sdk.client.experimental as unknown as {
    console: {
      listOrgs(): Promise<{ data?: { orgs?: Org[] } }>
      switchOrg(input: { accountID: string; orgID: string }): Promise<unknown>
    }
  }

  const [orgs] = createResource(async () => {
    const result = await console.console.listOrgs()
    return result.data?.orgs ?? []
  })

  const current = createMemo(() => orgs()?.find((item) => item.active))

  const options = createMemo(() => {
    const listed = orgs()
    if (listed === undefined) {
      return [{ title: "Loading orgs...", value: "loading" }]
    }
    if (listed.length === 0) {
      return [{ title: "No orgs found", value: "empty" }]
    }

    return listed
      .toSorted((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1
        const account = `${a.accountEmail} ${host(a.accountUrl)}`.localeCompare(
          `${b.accountEmail} ${host(b.accountUrl)}`,
        )
        if (account !== 0) return account
        return a.orgName.localeCompare(b.orgName)
      })
      .map((item) => ({
        title: item.orgName,
        value: item,
        category: `${item.accountEmail}  ${host(item.accountUrl)}`,
        categoryView: (
          <box flexDirection="row" gap={2}>
            <text fg={theme.primary}>{item.accountEmail}</text>
            <text fg={theme.textMuted}>{host(item.accountUrl)}</text>
          </box>
        ),
        onSelect: async () => {
          if (item.active) {
            dialog.clear()
            return
          }
          await console.console.switchOrg({
            accountID: item.accountID,
            orgID: item.orgID,
          })
          await sdk.client.instance.dispose()
          await sync.bootstrap()
          toast.show({
            message: `Switched to ${item.orgName}`,
            variant: "info",
          })
          dialog.clear()
        },
      }))
  })

  return (
    <DialogSelect<string | NonNullable<ReturnType<typeof current>>>
      title="Switch org"
      options={options()}
      current={current()}
    />
  )
}
