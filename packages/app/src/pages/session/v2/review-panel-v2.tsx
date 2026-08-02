import { createEffect, createMemo, createSignal, Show, type JSX } from "solid-js"
import type { SnapshotFileDiff, VcsFileDiff } from "@slopcode-ai/sdk/v2"
import { Virtualizer } from "virtua/solid"
import { IconButton } from "@slopcode-ai/ui/icon-button"
import { FileIcon } from "@slopcode-ai/ui/file-icon"
import { ResizeHandle } from "@slopcode-ai/ui/resize-handle"
import FileTreeV2 from "@/components/file-tree-v2"
import { useLanguage } from "@/context/language"
import { activeReviewFile, filterRenderableDiff, filterReviewFiles, reviewDiffKinds } from "./review-diff-kinds"
import type { ReviewPanelV2State } from "./review-panel-v2-state"

export function ReviewPanelV2(props: {
  diffs: () => (SnapshotFileDiff | VcsFileDiff)[]
  ready: () => boolean
  active?: string
  onSelect: (path: string) => void
  state: ReviewPanelV2State
  content: (path: string | undefined) => JSX.Element
}) {
  const language = useLanguage()
  const diffs = createMemo(() => props.diffs().filter(filterRenderableDiff))
  const files = createMemo(() => diffs().map((diff) => diff.file))
  const filtered = createMemo(() => filterReviewFiles(files(), props.state.filter()))
  const kinds = createMemo(() => reviewDiffKinds(diffs()))
  const active = createMemo(() => activeReviewFile(files(), filtered(), props.active))
  const [filteredRoot, setFilteredRoot] = createSignal<HTMLDivElement>()

  createEffect(() => {
    const path = active()
    if (!path || path === props.active) return
    props.onSelect(path)
  })

  return (
    <div class="size-full min-h-0 flex bg-background-stronger contain-strict" data-component="review-panel-v2">
      <Show when={props.state.opened()}>
        <aside
          class="relative h-full shrink-0 flex flex-col border-r border-border-weaker-base bg-background-base"
          style={{ width: `${props.state.width()}px` }}
          aria-label={language.t("session.review.filesChanged", { count: files().length })}
        >
          <div class="h-10 shrink-0 px-2 flex items-center gap-2 border-b border-border-weaker-base">
            <input
              type="search"
              value={props.state.filter()}
              onInput={(event) => props.state.setFilter(event.currentTarget.value)}
              placeholder={language.t("session.header.searchFiles")}
              aria-label={language.t("session.header.searchFiles")}
              class="h-7 min-w-0 flex-1 rounded-md border border-border-weak-base bg-background-stronger px-2 text-12-regular text-text-strong outline-none focus:border-border-strong-base"
            />
          </div>
          <div class="flex-1 min-h-0 overflow-hidden p-2">
            <Show
              when={props.ready()}
              fallback={<div class="px-2 py-2 text-12-regular text-text-weak">{language.t("session.review.loadingChanges")}</div>}
            >
              <Show
                when={props.state.filter().trim().length > 0}
                fallback={
                  <FileTreeV2
                    allowed={files()}
                    kinds={kinds()}
                    draggable={false}
                    active={active()}
                    onFileClick={(node) => props.onSelect(node.path)}
                  />
                }
              >
                <div ref={setFilteredRoot} class="size-full overflow-auto">
                  <Show when={filteredRoot()}>
                    {(scroll) => (
                      <Virtualizer data={filtered()} itemSize={30} scrollRef={scroll()}>
                        {(path) => (
                          <div class="h-[30px] py-px" data-path={path}>
                            <button
                              type="button"
                              class="h-7 w-full flex items-center gap-1.5 rounded-md px-2 text-left text-12-medium text-text-weak hover:bg-surface-raised-base-hover"
                              classList={{ "bg-surface-base-active text-text-strong": path === active() }}
                              onClick={() => props.onSelect(path)}
                            >
                              <FileIcon node={{ path, type: "file" }} class="size-4 shrink-0" />
                              <span class="min-w-0 flex-1 truncate">{path}</span>
                            </button>
                          </div>
                        )}
                      </Virtualizer>
                    )}
                  </Show>
                </div>
              </Show>
            </Show>
          </div>
          <div class="absolute inset-y-0 right-0" onPointerDown={(event) => event.stopPropagation()}>
            <ResizeHandle
              direction="horizontal"
              size={props.state.width()}
              min={180}
              max={360}
              onResize={props.state.resize}
            />
          </div>
        </aside>
      </Show>
      <section class="relative min-w-0 flex-1 h-full overflow-hidden">
        <div class="absolute left-2 top-2 z-20">
          <IconButton
            icon="layout-left"
            variant="ghost"
            onClick={props.state.toggle}
            aria-label={language.t("session.header.searchFiles")}
          />
        </div>
        {props.content(active())}
      </section>
    </div>
  )
}
