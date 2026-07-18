import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { createStore } from "solid-js/store"
import { For, Show } from "solid-js"
import { useBindings } from "../keymap"
import { DialogConfirm } from "../ui/dialog-confirm"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"

export function DialogSessionDeleteFailed(props: {
  session: string
  workspace: string
  onDelete?: () => boolean | void | Promise<boolean | void>
  onRestore?: () => boolean | void | Promise<boolean | void>
  onDone?: () => void
}) {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    active: "restore" as "delete" | "restore",
    confirming: false,
  })
  let pending = false

  const options = [
    {
      id: "delete" as const,
      title: "Delete workspace",
      description: "Delete the workspace and all sessions attached to it.",
      run: props.onDelete,
    },
    {
      id: "restore" as const,
      title: "Restore to new workspace",
      description: "Try to restore this session into a new workspace.",
      run: props.onRestore,
    },
  ]

  async function run(active: "delete" | "restore") {
    if (pending) return
    const option = options.find((item) => item.id === active)
    if (!option) return
    pending = true
    const result = await Promise.resolve()
      .then(() => option.run?.())
      .catch((error) => {
        toast.show({
          variant: "error",
          title: "Failed to recover session",
          message: errorMessage(error),
        })
        return false
      })
    pending = false
    if (result === false) return
    props.onDone?.()
    if (!props.onDone) dialog.clear()
  }

  function confirm(active = store.active) {
    if (pending) return
    if (active === "delete") {
      setStore("confirming", true)
      return
    }
    void run(active)
  }

  useBindings(() => ({
    enabled: !store.confirming,
    bindings: [
      { key: "return", desc: "Confirm recovery option", group: "Dialog", cmd: () => confirm() },
      { key: "left", desc: "Delete broken session", group: "Dialog", cmd: () => setStore("active", "delete") },
      { key: "up", desc: "Delete broken session", group: "Dialog", cmd: () => setStore("active", "delete") },
      { key: "right", desc: "Restore broken session", group: "Dialog", cmd: () => setStore("active", "restore") },
      { key: "down", desc: "Restore broken session", group: "Dialog", cmd: () => setStore("active", "restore") },
    ],
  }))

  return (
    <Show
      when={store.confirming}
      fallback={
        <box paddingLeft={2} paddingRight={2} gap={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text attributes={TextAttributes.BOLD} fg={theme.text}>
              Failed to Delete Session
            </text>
            <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
              esc
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="word">
            {`The session "${props.session}" could not be deleted because the workspace "${props.workspace}" is not available.`}
          </text>
          <text fg={theme.textMuted} wrapMode="word">
            Choose how you want to recover this broken workspace session.
          </text>
          <box flexDirection="column" paddingBottom={1} gap={1}>
            <For each={options}>
              {(item) => (
                <box
                  flexDirection="column"
                  paddingLeft={1}
                  paddingRight={1}
                  paddingTop={1}
                  paddingBottom={1}
                  backgroundColor={item.id === store.active ? theme.primary : undefined}
                  onMouseUp={() => {
                    setStore("active", item.id)
                    confirm(item.id)
                  }}
                >
                  <text
                    attributes={TextAttributes.BOLD}
                    fg={item.id === store.active ? theme.selectedListItemText : theme.text}
                  >
                    {item.title}
                  </text>
                  <text fg={item.id === store.active ? theme.selectedListItemText : theme.textMuted} wrapMode="word">
                    {item.description}
                  </text>
                </box>
              )}
            </For>
          </box>
        </box>
      }
    >
      <DialogConfirm
        title="Delete Workspace"
        message={`Delete workspace "${props.workspace}"? All sessions attached to it will be deleted.`}
        close={false}
        onConfirm={() => {
          setStore("confirming", false)
          void run("delete")
        }}
        onCancel={() => setStore("confirming", false)}
      />
    </Show>
  )
}
