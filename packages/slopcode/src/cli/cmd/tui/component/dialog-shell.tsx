import { createMemo, createResource } from "solid-js"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useToast } from "@tui/ui/toast"

export function DialogShell() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()

  const [shells] = createResource(async () => {
    const pty = sdk.client.pty as unknown as {
      shells(): Promise<{ data?: Array<{ path: string; name: string; acceptable: boolean }> }>
    }
    const result = await pty.shells()
    return (result.data ?? []).filter((item) => item.acceptable)
  })

  const current = createMemo(() => (sync.data.config.shell as { program?: string } | undefined)?.program)
  const options = createMemo(() => [
    {
      title: "Default",
      value: "__default__",
      description: "Use the system default shell",
      onSelect: async () => {
        await update(undefined)
      },
    },
    ...(shells() ?? []).map((item) => ({
      title: item.name,
      value: item.path,
      description: item.path,
      onSelect: async () => {
        await update(item.path)
      },
    })),
  ])

  const update = async (program: string | undefined) => {
    try {
      const current = await sdk.client.global.config.get({ throwOnError: true }).then((item) => item.data ?? {})
      await sdk.client.global.config.update(
        {
          config: {
            shell: {
              ...(current.shell ?? {}),
              ...(program ? { program } : {}),
              ...(program ? {} : { program: undefined }),
            },
          },
        },
        { throwOnError: true },
      )
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      toast.show({
        variant: "success",
        message: program ? `Shell set to ${program}` : "Shell reset to system default",
      })
      dialog.clear()
    } catch {
      toast.show({
        variant: "error",
        message: "Failed to update shell",
      })
    }
  }

  return <DialogSelect title="Select shell" options={options()} current={current() ?? "__default__"} flat={true} />
}
