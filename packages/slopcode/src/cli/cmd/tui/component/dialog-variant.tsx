import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { usePromptRef } from "@tui/context/prompt"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { dismissPromptSlash } from "../util/prompt-slash"

export function DialogVariant() {
  const local = useLocal()
  const dialog = useDialog()
  const promptRef = usePromptRef()

  const options = createMemo(() => [
    {
      value: "default",
      title: "Default",
      onSelect: () => {
        dismissPromptSlash(promptRef.current)
        dialog.clear()
        local.model.variant.set(undefined)
      },
    },
    ...local.model.variant.list().map((variant) => ({
      value: variant,
      title: variant,
      onSelect: () => {
        dismissPromptSlash(promptRef.current)
        dialog.clear()
        local.model.variant.set(variant)
      },
    })),
  ])

  return (
    <DialogSelect<string>
      options={options()}
      title="Select variant"
      current={local.model.variant.selected()}
      flat={true}
    />
  )
}
