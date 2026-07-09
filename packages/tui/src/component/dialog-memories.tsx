import { createMemo, createSignal, onMount } from "solid-js"
import { TextAttributes } from "@opentui/core"
import type { Memory as MemoryInfo } from "@slopcode-ai/sdk/v2"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { DialogConfirm } from "../ui/dialog-confirm"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useToast } from "../ui/toast"
import { active, metadata } from "../prompt/memory"

type Value =
  | {
      type: "session"
    }
  | {
      type: "memory"
      id: string
    }

function Status(props: { enabled: boolean; inherited?: boolean }) {
  const { theme } = useTheme()
  if (props.enabled) {
    return (
      <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>
        ✓ Enabled{props.inherited ? " by config" : ""}
      </span>
    )
  }
  return <span style={{ fg: theme.textMuted }}>○ Disabled</span>
}

export function DialogMemories(props: { sessionID: string }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const [items, setItems] = createSignal<MemoryInfo[]>([])
  const [loading, setLoading] = createSignal(false)
  const session = createMemo(() => sync.session.get(props.sessionID))
  const enabled = createMemo(() => active(session()?.metadata, sync.data.config.memory))
  const inherited = createMemo(() => session()?.metadata?.memory === undefined && sync.data.config.memory?.enabled === true)

  async function refresh() {
    setLoading(true)
    const result = await sdk.client.memory.list({ includeDisabled: true })
    if (result.data) setItems(result.data)
    if (result.error) toast.show({ variant: "error", message: "Failed to load memories" })
    setLoading(false)
  }

  onMount(() => void refresh())

  async function sessionToggle() {
    const current = session()
    if (!current) return
    await sdk.client.session.update({
      sessionID: props.sessionID,
      metadata: metadata(current.metadata, { status: enabled() ? "disabled" : "enabled" }),
    })
  }

  async function add(scope: "project" | "global") {
    const value = await DialogPrompt.show(dialog, scope === "project" ? "Add Project Memory" : "Add Global Memory", {
      placeholder: "Remember that...",
    })
    const content = value?.trim()
    if (!content) return
    const result = await sdk.client.memory.create({ memoryCreateInput: { content, scope } })
    if (result.error) {
      toast.show({ variant: "error", message: "Failed to save memory" })
      return
    }
    dialog.replace(() => <DialogMemories sessionID={props.sessionID} />)
  }

  async function toggle(item: MemoryInfo) {
    const result = await sdk.client.memory.update({ memoryID: item.id, memoryUpdateInput: { enabled: !item.enabled } })
    if (result.error) toast.show({ variant: "error", message: "Failed to update memory" })
    await refresh()
  }

  async function remove(item: MemoryInfo) {
    const ok = await DialogConfirm.show(dialog, "Delete Memory", "Delete this memory permanently?")
    if (ok !== true) return
    const result = await sdk.client.memory.delete({ memoryID: item.id })
    if (result.error) toast.show({ variant: "error", message: "Failed to delete memory" })
    await refresh()
  }

  const options = createMemo<DialogSelectOption<Value>[]>(() => [
    {
      title: "Use memories in this session",
      value: { type: "session" },
      description: "Opt this session in or out",
      category: "Session",
      footer: <Status enabled={enabled()} inherited={inherited()} />,
    },
    ...items().map((item) => ({
      title: item.content,
      value: { type: "memory" as const, id: item.id },
      description: item.scope === "project" ? "Project memory" : "Global memory",
      category: item.scope === "project" ? "Project" : "Global",
      footer: <Status enabled={item.enabled} />,
    })),
  ])

  function selected(option: DialogSelectOption<Value>) {
    const value = option.value
    if (value.type !== "memory") return
    return items().find((item) => item.id === value.id)
  }

  return (
    <DialogSelect
      title="Memories"
      placeholder={loading() ? "Loading memories" : "Search memories"}
      options={options()}
      actions={[
        {
          command: "dialog.memory.toggle",
          title: "Toggle",
          onTrigger: (option) => {
            if (option.value.type === "session") return void sessionToggle()
            const item = selected(option)
            if (item) void toggle(item)
          },
        },
        {
          command: "dialog.memory.add_project",
          title: "Add project",
          onTrigger: () => void add("project"),
        },
        {
          command: "dialog.memory.add_global",
          title: "Add global",
          onTrigger: () => void add("global"),
        },
        {
          command: "dialog.memory.delete",
          title: "Delete",
          disabled: (option) => option?.value.type !== "memory",
          onTrigger: (option) => {
            const item = selected(option)
            if (item) void remove(item)
          },
        },
      ]}
      onSelect={(option) => {
        if (option.value.type === "session") return void sessionToggle()
        const item = selected(option)
        if (item) void toggle(item)
      }}
    />
  )
}
