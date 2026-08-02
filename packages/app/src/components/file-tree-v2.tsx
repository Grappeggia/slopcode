import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { Virtualizer, type VirtualizerHandle } from "virtua/solid"
import type { FileNode } from "@slopcode-ai/sdk/v2"
import { FileIcon } from "@slopcode-ai/ui/file-icon"
import { Icon } from "@slopcode-ai/ui/icon"
import { useFile } from "@/context/file"
import { pathToFileUrl, withFileDragImage, type Kind } from "@/components/file-tree"
import {
  buildFileTreeV2Model,
  flattenFileTreeV2,
  flattenLiveFileTreeV2,
  normalizeFileTreeV2Path,
  type FileTreeV2Node,
  type FileTreeV2Row,
} from "@/components/file-tree-v2-model"

export type { Kind } from "@/components/file-tree"

export const kindLabel = (kind: Kind) => {
  if (kind === "add") return "A"
  if (kind === "del") return "D"
  return "M"
}

const kindColor = (kind: Kind) => {
  if (kind === "add") return "text-success-base"
  if (kind === "del") return "text-error-base"
  return "text-info-base"
}

export default function FileTreeV2(props: {
  active?: string
  allowed?: readonly string[]
  kinds?: ReadonlyMap<string, Kind>
  draggable?: boolean
  onFileClick?: (file: FileNode) => void
  onFileDoubleClick?: (file: FileNode) => void
}) {
  const file = useFile()
  const live = () => props.allowed === undefined
  const draggable = () => props.draggable ?? true
  const active = () => normalizeFileTreeV2Path(props.active ?? "")
  const model = createMemo(() => (live() ? undefined : buildFileTreeV2Model(props.allowed ?? [])))
  const expanded = (path: string) => file.tree.state(path)?.expanded ?? !live()
  const rows = createMemo(() => {
    if (live()) return flattenLiveFileTreeV2((path) => file.tree.children(path), expanded)
    return flattenFileTreeV2(model()!, expanded)
  })
  const [root, setRoot] = createSignal<HTMLDivElement>()
  const [focused, setFocused] = createSignal<string>()
  let virtualizer: VirtualizerHandle | undefined

  createEffect(() => {
    if (!live()) return
    void file.tree.list("")
  })

  let scrolled: string | undefined
  createEffect(() => {
    const path = active()
    if (!path) {
      scrolled = undefined
      return
    }
    const index = rows().findIndex((row) => row.node.path === path)
    if (index < 0 || scrolled === path) return
    scrolled = path
    queueMicrotask(() => virtualizer?.scrollToIndex(index, { align: "center" }))
  })

  const mounted = createMemo(() => {
    const path = focused()
    if (!path) return
    const index = rows().findIndex((row) => row.node.path === path)
    if (index < 0) return
    return [index]
  })

  const select = (node: FileTreeV2Node, action?: (file: FileNode) => void) => {
    action?.({ ...node, path: node.originalPath, absolute: node.originalPath })
  }

  const toggle = (row: FileTreeV2Row) => {
    if (expanded(row.node.path)) {
      file.tree.collapse(row.node.originalPath)
      return
    }
    file.tree.expand(row.node.originalPath)
  }

  return (
    <div ref={setRoot} class="size-full min-h-0 overflow-auto" data-component="file-tree-v2">
      <Show when={root()}>
        {(scroll) => (
          <Virtualizer
            data={rows()}
            itemSize={30}
            scrollRef={scroll()}
            keepMounted={mounted()}
            ref={(handle) => (virtualizer = handle)}
          >
            {(row) => (
              <div class="h-[30px] py-px">
                <Show
                  when={row.node.type === "directory"}
                  fallback={
                    <button
                      type="button"
                      data-slot="file-tree-v2-row"
                      data-path={row.node.path}
                      data-selected={row.node.path === active() ? "" : undefined}
                      class="group relative w-full h-7 min-w-0 flex items-center gap-1.5 pr-2 rounded-md text-left text-12-medium text-text-weak hover:bg-surface-raised-base-hover data-[selected]:bg-surface-base-active data-[selected]:text-text-strong"
                      style={`padding-left: ${8 + row.level * 16}px`}
                      draggable={draggable()}
                      onFocus={() => setFocused(row.node.path)}
                      onBlur={() => setFocused(undefined)}
                      onDragStart={(event) => {
                        if (!draggable()) return
                        event.dataTransfer?.setData("text/plain", `file:${row.node.originalPath}`)
                        event.dataTransfer?.setData("text/uri-list", pathToFileUrl(row.node.originalPath))
                        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy"
                        withFileDragImage(event)
                      }}
                      onClick={() => select(row.node, props.onFileClick)}
                      onDblClick={() => select(row.node, props.onFileDoubleClick)}
                    >
                      <span class="w-4 shrink-0" />
                      <span class="relative size-4 shrink-0">
                        <FileIcon node={row.node} class="absolute inset-0 size-4 filetree-icon filetree-icon--color" />
                      </span>
                      <span class="flex-1 min-w-0 truncate">{row.node.name}</span>
                      <Show when={props.kinds?.get(row.node.path)}>
                        {(kind) => <span class={`w-4 text-center ${kindColor(kind())}`}>{kindLabel(kind())}</span>}
                      </Show>
                    </button>
                  }
                >
                  <button
                    type="button"
                    data-slot="file-tree-v2-row"
                    data-path={row.node.path}
                    class="relative w-full h-7 min-w-0 flex items-center gap-1.5 pr-2 rounded-md text-left text-12-medium text-text-weak hover:bg-surface-raised-base-hover"
                    style={`padding-left: ${8 + row.level * 16}px`}
                    aria-expanded={expanded(row.node.path)}
                    onFocus={() => setFocused(row.node.path)}
                    onBlur={() => setFocused(undefined)}
                    onClick={() => toggle(row)}
                  >
                    <Icon name={expanded(row.node.path) ? "chevron-down" : "chevron-right"} size="small" />
                    <FileIcon node={row.node} class="size-4 shrink-0 filetree-icon filetree-icon--color" />
                    <span class="flex-1 min-w-0 truncate">{row.node.name}</span>
                  </button>
                </Show>
              </div>
            )}
          </Virtualizer>
        )}
      </Show>
    </div>
  )
}
