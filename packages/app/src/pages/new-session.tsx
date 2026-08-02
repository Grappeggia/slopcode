import { createEffect, createMemo, createSignal, onMount, untrack } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { NewSessionDesignView } from "@/components/session"
import { useComments } from "@/context/comments"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { createSessionComposerState, SessionComposerRegion } from "@/pages/session/composer"
import { normalizeNewSessionWorktree, resolveNewSessionWorktree } from "./new-session/new-session-workspace-controller"

/**
 * The `/new-session` draft page. Unlike `session.tsx`, this only renders the prompt
 * composer for a brand-new session — no terminal, review pane, file tree, or message
 * timeline. Submitting promotes the draft into a real session (see prompt-input/submit).
 */
export default function NewSessionPage() {
  const prompt = usePrompt()
  const sdk = useSDK()
  const sync = useSync()
  const comments = useComments()
  const [searchParams, setSearchParams] = useSearchParams<{ prompt?: string }>()

  let inputRef: HTMLDivElement | undefined

  const composer = createSessionComposerState()

  const [selectedWorktree, setSelectedWorktree] = createSignal<string>()

  const newSessionWorktree = createMemo(() => {
    return resolveNewSessionWorktree({
      selected: selectedWorktree(),
      directory: sdk.directory,
      projectWorktree: sync.project?.worktree,
    })
  })

  const setNewSessionWorktree = (value: string) => {
    setSelectedWorktree(normalizeNewSessionWorktree(value, sdk.directory, sync.project?.worktree))
  }

  createEffect(() => {
    if (!prompt.ready()) return
    untrack(() => {
      const text = searchParams.prompt
      if (!text) return
      prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
      setSearchParams({ ...searchParams, prompt: undefined })
    })
  })

  onMount(() => {
    requestAnimationFrame(() => inputRef?.focus())
  })

  return (
    <div class="relative size-full overflow-hidden flex flex-col">
      <div class="flex-1 min-h-0 flex flex-col gap-2 p-2">
        <div class="@container relative flex flex-col min-h-0 h-full bg-background-stronger flex-1">
          <div class="flex-1 min-h-0 overflow-hidden rounded-[10px]">
            <NewSessionDesignView>
              <SessionComposerRegion
                state={composer}
                ready
                centered={false}
                placement="inline"
                inputRef={(el) => {
                  inputRef = el
                }}
                newSessionWorktree={newSessionWorktree()}
                onNewSessionWorktreeChange={setNewSessionWorktree}
                onNewSessionWorktreeReset={() => setSelectedWorktree()}
                onSubmit={() => comments.clear()}
                onResponseSubmit={() => {}}
                setPromptDockRef={() => {}}
              />
            </NewSessionDesignView>
          </div>
        </div>
      </div>
    </div>
  )
}
