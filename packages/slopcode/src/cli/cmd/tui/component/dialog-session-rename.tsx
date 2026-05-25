import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { usePromptRef } from "@tui/context/prompt"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { createMemo } from "solid-js"
import { useSDK } from "../context/sdk"
import { dismissPromptSlash } from "../util/prompt-slash"

interface DialogSessionRenameProps {
  session: string
  workspaceID?: string
}

export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog()
  const promptRef = usePromptRef()
  const sync = useSync()
  const sdk = useSDK()
  const session = createMemo(() => sync.session.get(props.session))

  return (
    <DialogPrompt
      title="Rename Session"
      value={session()?.title}
      onConfirm={(value) => {
        sdk.clientFor(props.workspaceID).session.update({
          sessionID: props.session,
          title: value,
        })
        dismissPromptSlash(promptRef.current)
        dialog.clear()
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
