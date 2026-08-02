import { useDialog } from "@slopcode-ai/ui/context/dialog"
import { Dialog } from "@slopcode-ai/ui/dialog"
import { FileIcon } from "@slopcode-ai/ui/file-icon"
import { Icon } from "@slopcode-ai/ui/icon"
import { Keybind } from "@slopcode-ai/ui/keybind"
import { List } from "@slopcode-ai/ui/list"
import { getDirectory, getFilename } from "@slopcode-ai/core/util/path"
import { useNavigate } from "@solidjs/router"
import { createMemo, createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { formatKeybind, useCommand } from "@/context/command"
import { useServerSDK } from "@/context/server-sdk"
import { useGlobal } from "@/context/global"
import { ServerConnection, useServer } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { useLayout } from "@/context/layout"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useSessionLayout } from "@/pages/session/session-layout"
import { createSessionTabs } from "@/pages/session/helpers"
import { getRelativeTime } from "@/utils/time"
import {
  commandPaletteEntries,
  createServerSessionSearch,
  filePaletteEntries,
  searchPaletteEntries,
  selectPaletteSession,
  uniquePaletteEntries,
  type PaletteEntry,
} from "./dialog-select-file-controller"

type Entry = PaletteEntry

type DialogSelectFileMode = "all" | "files"

const ENTRY_LIMIT = 5
const COMMON_COMMAND_IDS = [
  "session.new",
  "workspace.new",
  "session.previous",
  "session.next",
  "terminal.toggle",
  "review.toggle",
] as const

function createCommandEntries(props: {
  filesOnly: () => boolean
  command: ReturnType<typeof useCommand>
  language: ReturnType<typeof useLanguage>
}) {
  const allowed = createMemo(() => {
    if (props.filesOnly()) return []
    return props.command.options.filter(
      (option) =>
        !option.disabled && !option.hidden && !option.id.startsWith("suggested.") && option.id !== "file.open",
    )
  })

  const list = createMemo(() => {
    const category = props.language.t("palette.group.commands")
    return commandPaletteEntries(allowed(), category)
  })

  const picks = createMemo(() => {
    const all = allowed()
    const order = new Map<string, number>(COMMON_COMMAND_IDS.map((id, index) => [id, index]))
    const picked = all.filter((option) => order.has(option.id))
    const base = picked.length ? picked : all.slice(0, ENTRY_LIMIT)
    const sorted = picked.length ? [...base].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) : base
    const category = props.language.t("palette.group.commands")
    return commandPaletteEntries(sorted, category)
  })

  return { allowed, list, picks }
}

function createFileEntries(props: {
  file: ReturnType<typeof useFile>
  tabs: () => ReturnType<ReturnType<typeof useLayout>["tabs"]>
  language: ReturnType<typeof useLanguage>
}) {
  const tabState = createSessionTabs({
    tabs: props.tabs,
    pathFromTab: props.file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? props.file.tab(tab) : tab),
  })
  const recent = createMemo(() => {
    const all = tabState.openedTabs()
    const active = tabState.activeFileTab()
    const order = active ? [active, ...all.filter((item) => item !== active)] : all
    const seen = new Set<string>()
    const category = props.language.t("palette.group.files")
    const items: string[] = []

    for (const item of order) {
      const path = props.file.pathFromTab(item)
      if (!path) continue
      if (seen.has(path)) continue
      seen.add(path)
      items.push(path)
    }

    return filePaletteEntries(items.slice(0, ENTRY_LIMIT), category)
  })

  const root = createMemo(() => {
    const category = props.language.t("palette.group.files")
    const nodes = props.file.tree.children("")
    const paths = nodes
      .filter((node) => node.type === "file")
      .map((node) => node.path)
      .sort((a, b) => a.localeCompare(b))
    return filePaletteEntries(paths.slice(0, ENTRY_LIMIT), category)
  })

  return { recent, root }
}

export function DialogSelectFile(props: { mode?: DialogSelectFileMode; onOpenFile?: (path: string) => void }) {
  const command = useCommand()
  const language = useLanguage()
  const layout = useLayout()
  const file = useFile()
  const dialog = useDialog()
  const navigate = useNavigate()
  const serverSDK = useServerSDK()
  const global = useGlobal()
  const server = useServer()
  const appTabs = useTabs()
  const { tabs, view } = useSessionLayout()
  const filesOnly = () => props.mode === "files"
  const state = { cleanup: undefined as (() => void) | void, committed: false }
  const [grouped, setGrouped] = createSignal(false)
  const [failure, setFailure] = createSignal("")
  const commandEntries = createCommandEntries({ filesOnly, command, language })
  const fileEntries = createFileEntries({ file, tabs, language })
  const conn = server.current
  const serverCtx = conn ? global.createServerCtx(conn) : undefined
  const sessions = createServerSessionSearch({
    server: server.key,
    opened: () => serverCtx?.projects.list() ?? [],
    stored: () => serverCtx?.sync.data.project ?? [],
    load: (search, signal) =>
      serverSDK.client.session
        .list({ roots: true, search, limit: 50 }, { signal })
        .then((result) => result.data ?? []),
    untitled: () => language.t("command.session.new"),
    category: () => language.t("command.category.session"),
  })

  const items = async (text: string) => {
    const query = text.trim()
    setGrouped(query.length > 0)
    setFailure("")

    if (!query && filesOnly()) {
      const loaded = file.tree.state("")?.loaded
      const pending = loaded ? Promise.resolve() : file.tree.list("")
      const next = uniquePaletteEntries([...fileEntries.recent(), ...fileEntries.root()])

      if (loaded || next.length > 0) {
        void pending
        return next
      }

      await pending
      return uniquePaletteEntries([...fileEntries.recent(), ...fileEntries.root()])
    }

    if (!query) return [...commandEntries.picks(), ...fileEntries.recent()]

    if (filesOnly()) {
      const files = await file.searchFiles(query)
      const category = language.t("palette.group.files")
      return filePaletteEntries(files, category)
    }

    return searchPaletteEntries({
      query,
      commands: commandEntries.list(),
      searchFiles: file.searchFiles,
      searchSessions: (search) =>
        sessions.search(search).catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return []
          setFailure(language.t("toast.session.listFailed.title", { project: server.name || server.key }))
          return []
        }),
      fileCategory: language.t("palette.group.files"),
    })
  }

  const handleMove = (item: Entry | undefined) => {
    state.cleanup?.()
    if (!item) return
    if (item.type !== "command") return
    state.cleanup = item.option?.onHighlight?.()
  }

  const open = (path: string) => {
    const value = file.tab(path)
    void tabs().open(value)
    void file.load(path)
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
    layout.fileTree.setTab("all")
    props.onOpenFile?.(path)
    tabs().setActive(value)
  }

  const handleSelect = (item: Entry | undefined) => {
    if (!item) return
    state.committed = true
    state.cleanup = undefined
    dialog.close()

    if (item.type === "command") {
      item.option?.onSelect?.("palette")
      return
    }

    if (item.type === "session") {
      if (!serverCtx) return
      selectPaletteSession({ entry: item, tabs: appTabs, projects: serverCtx.projects, navigate })
      return
    }

    if (!item.path) return
    open(item.path)
  }

  onCleanup(() => {
    sessions.cancel()
    if (state.committed) return
    state.cleanup?.()
  })

  return (
    <Dialog class="pt-3 pb-0 !max-h-[480px]" transition>
      <Show when={failure()}>
        <div role="alert" class="px-4 pb-2 text-12-regular text-text-critical-base">
          {failure()}
        </div>
      </Show>
      <List
        class="px-3"
        search={{
          placeholder: filesOnly()
            ? language.t("session.header.searchFiles")
            : language.t("palette.search.placeholder"),
          autofocus: true,
          hideIcon: true,
        }}
        emptyMessage={language.t("palette.empty")}
        loadingMessage={language.t("common.loading")}
        items={items}
        key={(item) => item.id}
        filterKeys={["title", "description", "category"]}
        skipFilter={(item) => item.type === "file"}
        groupBy={grouped() ? (item) => item.category : () => ""}
        onMove={handleMove}
        onSelect={handleSelect}
      >
        {(item) => <PaletteEntryRow item={item} language={language} />}
      </List>
    </Dialog>
  )
}

export function DialogHomeCommandPalette(props: { server: ServerConnection.Any }) {
  const command = useCommand()
  const language = useLanguage()
  const dialog = useDialog()
  const navigate = useNavigate()
  const global = useGlobal()
  const appTabs = useTabs()
  const server = ServerConnection.key(props.server)
  const serverCtx = global.createServerCtx(props.server)
  const state = { cleanup: undefined as (() => void) | void, committed: false }
  const [grouped, setGrouped] = createSignal(false)
  const [failure, setFailure] = createSignal("")
  const commands = createCommandEntries({ filesOnly: () => false, command, language })
  const sessions = createServerSessionSearch({
    server,
    opened: serverCtx.projects.list,
    stored: () => serverCtx.sync.data.project,
    load: (search, signal) =>
      serverCtx.sdk.client.session
        .list({ roots: true, search, limit: 50 }, { signal })
        .then((result) => result.data ?? []),
    untitled: () => language.t("command.session.new"),
    category: () => language.t("command.category.session"),
  })

  const items = async (text: string) => {
    const query = text.trim()
    setGrouped(query.length > 0)
    setFailure("")
    if (!query) return commands.picks()

    return searchPaletteEntries({
      query,
      commands: commands.list(),
      searchFiles: async () => [],
      searchSessions: (search) =>
        sessions.search(search).catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return []
          setFailure(language.t("toast.session.listFailed.title", { project: props.server.displayName ?? server }))
          return []
        }),
      fileCategory: language.t("palette.group.files"),
    })
  }

  const handleMove = (item: Entry | undefined) => {
    state.cleanup?.()
    state.cleanup = undefined
    if (item?.type !== "command") return
    state.cleanup = item.option?.onHighlight?.()
  }

  const handleSelect = (item: Entry | undefined) => {
    if (!item) return
    state.committed = true
    state.cleanup = undefined
    dialog.close()
    if (item.type === "command") {
      item.option?.onSelect?.("palette")
      return
    }
    selectPaletteSession({ entry: item, tabs: appTabs, projects: serverCtx.projects, navigate })
  }

  onCleanup(() => {
    sessions.cancel()
    if (state.committed) return
    state.cleanup?.()
  })

  return (
    <Dialog class="pt-3 pb-0 !max-h-[480px]" transition>
      <Show when={failure()}>
        <div role="alert" class="px-4 pb-2 text-12-regular text-text-critical-base">
          {failure()}
        </div>
      </Show>
      <List
        class="px-3"
        search={{ placeholder: language.t("palette.search.placeholder"), autofocus: true, hideIcon: true }}
        emptyMessage={language.t("palette.empty")}
        loadingMessage={language.t("common.loading")}
        items={items}
        key={(item) => item.id}
        filterKeys={["title", "description", "category"]}
        groupBy={grouped() ? (item) => item.category : () => ""}
        onMove={handleMove}
        onSelect={handleSelect}
      >
        {(item) => <PaletteEntryRow item={item} language={language} />}
      </List>
    </Dialog>
  )
}

function PaletteEntryRow(props: { item: Entry; language: ReturnType<typeof useLanguage> }) {
  return (
    <Switch
      fallback={
        <div class="w-full flex items-center justify-between rounded-md pl-1">
          <div class="flex items-center gap-x-3 grow min-w-0">
            <FileIcon node={{ path: props.item.path ?? "", type: "file" }} class="shrink-0 size-4" />
            <div class="flex items-center text-14-regular">
              <span class="text-text-weak whitespace-nowrap overflow-hidden overflow-ellipsis truncate min-w-0">
                {getDirectory(props.item.path ?? "")}
              </span>
              <span class="text-text-strong whitespace-nowrap">{getFilename(props.item.path ?? "")}</span>
            </div>
          </div>
        </div>
      }
    >
      <Match when={props.item.type === "command"}>
        <div class="w-full flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-14-regular text-text-strong whitespace-nowrap">{props.item.title}</span>
            <Show when={props.item.description}>
              <span class="text-14-regular text-text-weak truncate">{props.item.description}</span>
            </Show>
          </div>
          <Show when={props.item.keybind}>
            <Keybind class="rounded-[4px]">{formatKeybind(props.item.keybind ?? "", props.language.t)}</Keybind>
          </Show>
        </div>
      </Match>
      <Match when={props.item.type === "session"}>
        <div class="w-full flex items-center justify-between rounded-md pl-1">
          <div class="flex items-center gap-x-3 grow min-w-0">
            <Icon name="bubble-5" size="small" class="shrink-0 text-icon-weak" />
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="text-14-regular text-text-strong truncate"
                classList={{ "opacity-70": !!props.item.archived }}
              >
                {props.item.title}
              </span>
              <Show when={props.item.description}>
                <span
                  class="text-14-regular text-text-weak truncate"
                  classList={{ "opacity-70": !!props.item.archived }}
                >
                  {props.item.description}
                </span>
              </Show>
            </div>
          </div>
          <Show when={props.item.updated}>
            <span class="text-12-regular text-text-weak whitespace-nowrap ml-2">
              {getRelativeTime(new Date(props.item.updated!).toISOString(), props.language.t)}
            </span>
          </Show>
        </div>
      </Match>
    </Switch>
  )
}
