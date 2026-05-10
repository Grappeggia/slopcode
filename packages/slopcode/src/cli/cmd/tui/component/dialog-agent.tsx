import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { usePromptRef } from "@tui/context/prompt"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { dismissPromptSlash } from "../util/prompt-slash"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()
  const promptRef = usePromptRef()

  const options = createMemo(() =>
    local.agent.list().map((item) => {
      return {
        value: item.name,
        title: item.name,
        description: item.native ? "native" : item.description,
      }
    }),
  )

  return (
    <DialogSelect
      title="Select agent"
      current={local.agent.current().name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dismissPromptSlash(promptRef.current)
        dialog.clear()
      }}
    />
  )
}
