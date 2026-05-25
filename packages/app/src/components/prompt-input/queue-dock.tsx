import { useParams } from "@solidjs/router"
import { Button } from "@slopcode-ai/ui/button"
import { DockTray } from "@slopcode-ai/ui/dock-surface"
import { IconButton } from "@slopcode-ai/ui/icon-button"
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { promptQueue, promptQueueKey, type PromptQueueItem } from "./queue"

type Row = {
  id: string
  label: string
  summary: string
  detail?: string
  time: PromptQueueItem["time"]
}

const STALL_MS = 15_000

function age(ms: number) {
  const secs = Math.max(0, Math.round(ms / 1000))
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rest = secs % 60
  if (mins < 60) return rest > 0 ? `${mins}m ${rest}s` : `${mins}m`
  const hours = Math.floor(mins / 60)
  const left = mins % 60
  return left > 0 ? `${hours}h ${left}m` : `${hours}h`
}

export function promptQueueVisible(input: { active?: PromptQueueItem; queue: PromptQueueItem[] }) {
  return !!input.active || input.queue.length > 0
}

export function promptQueueRows(input: { active?: PromptQueueItem; queue: PromptQueueItem[] }) {
  const active = input.active
    ? [
        {
          id: input.active.id,
          label: "Active",
          summary: input.active.summary,
          detail: input.active.detail,
          time: input.active.time,
        },
      ]
    : []

  return [
    ...active,
    ...input.queue.map((item: PromptQueueItem) => ({
      id: item.id,
      label: "Queued",
      summary: item.summary,
      detail: item.detail,
      time: item.time,
    })),
  ]
}

const LIMIT = 4

export function PromptQueueDock() {
  const params = useParams()
  const sdk = useSDK()
  const syncState = useSync()
  const [store, setStore] = createStore({
    active: undefined as PromptQueueItem | undefined,
    queue: [] as PromptQueueItem[],
    collapsed: false,
  })
  const [now, setNow] = createSignal(Date.now())

  const key = createMemo(() => {
    if (!params.id) return
    return promptQueueKey(sdk.directory, params.id)
  })

  const sync = () => {
    const current = key()
    if (!current) {
      setStore("active", undefined)
      setStore("queue", [])
      return
    }
    const next = promptQueue.snapshot(current)
    setStore("active", next.active)
    setStore("queue", next.queue)
  }

  createEffect(on(key, sync))

  const off = promptQueue.subscribe((next: string) => {
    if (next !== key()) return
    sync()
  })

  onCleanup(off)

  const rows = createMemo<Row[]>(() =>
    promptQueueRows({
      active: store.active,
      queue: store.queue,
    }),
  )

  const items = createMemo(() => rows().slice(0, LIMIT))
  const hidden = createMemo(() => Math.max(0, rows().length - LIMIT))
  const preview = createMemo(() => store.active?.summary ?? store.queue[0]?.summary ?? "")
  const clearable = createMemo(() => store.queue.length > 0)
  const visible = createMemo(() => promptQueueVisible({ active: store.active, queue: store.queue }))
  const status = createMemo(() => syncState.data.session_status[params.id ?? ""])

  createEffect(() => {
    if (!visible()) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => window.clearInterval(timer))
  })

  const meta = (item: Row) => {
    const current = status()
    if (item.label === "Queued") {
      return [`Queued - ${age(now() - item.time.queued)}`, item.detail].filter(Boolean).join(" - ")
    }
    if (current?.type === "retry") {
      return [`Retrying in ${age(Math.max(0, current.next - now()))}`, item.detail].filter(Boolean).join(" - ")
    }
    const start = current?.type === "busy" ? current.since : (item.time.started ?? item.time.queued)
    const elapsed = age(now() - start)
    if (current?.type === "busy" && current.phase === "compacting") {
      return [`Compacting - ${elapsed}`, item.detail].filter(Boolean).join(" - ")
    }
    if (current?.type === "busy" && current.phase === "running") {
      return [`${now() - start >= STALL_MS ? "Still running..." : "Running"} - ${elapsed}`, item.detail]
        .filter(Boolean)
        .join(" - ")
    }
    return [`${now() - start >= STALL_MS ? "Still starting..." : "Starting"} - ${elapsed}`, item.detail]
      .filter(Boolean)
      .join(" - ")
  }

  const toggle = () => setStore("collapsed", (value: boolean) => !value)

  const clear = () => {
    const current = key()
    if (!current) return
    promptQueue.clear(current)
  }

  const remove = (id: string) => {
    const current = key()
    if (!current) return
    promptQueue.remove(current, (item: PromptQueueItem) => item.id === id)
  }

  return (
    <Show when={visible()}>
      <DockTray
        data-component="prompt-queue-dock"
        class="mb-2"
        classList={{
          "h-[74px]": store.collapsed,
        }}
      >
        <div
          data-action="prompt-queue-toggle"
          class="pl-3 pr-2 py-2 flex items-center gap-2"
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            toggle()
          }}
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-13-medium text-text-strong shrink-0">Prompt queue</span>
            <Show when={store.collapsed && preview()}>
              <div class="min-w-0 flex-1">
                <div class="text-13-regular text-text-base truncate">{preview()}</div>
              </div>
            </Show>
          </div>
          <div class="ml-auto flex items-center gap-1">
            <Show when={clearable()}>
              <Button
                type="button"
                variant="ghost"
                size="small"
                class="h-7 px-2 text-12-medium"
                onMouseDown={(event: MouseEvent) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event: MouseEvent) => {
                  event.stopPropagation()
                  clear()
                }}
              >
                Clear queue
              </Button>
            </Show>
            <IconButton
              data-action="prompt-queue-toggle-button"
              icon="chevron-down"
              size="normal"
              variant="ghost"
              classList={{ "rotate-180": store.collapsed }}
              onMouseDown={(event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event: MouseEvent) => {
                event.stopPropagation()
                toggle()
              }}
              aria-label={store.collapsed ? "Expand prompt queue" : "Collapse prompt queue"}
            />
          </div>
        </div>

        <div
          data-slot="prompt-queue-list"
          hidden={store.collapsed}
          class="border-t border-border-weak-base px-3 py-2 flex flex-col gap-2"
        >
          <For each={items()}>
            {(item: Row) => (
              <div class="flex items-start gap-2 min-w-0">
                <span
                  classList={{
                    "shrink-0 rounded-[6px] px-1.5 py-0.5 text-11-medium": true,
                    "bg-surface-info-base text-text-info-base": item.label === "Active",
                    "bg-background-stronger text-text-weak": item.label !== "Active",
                  }}
                >
                  {item.label}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-13-regular text-text-strong truncate">{item.summary}</div>
                  <Show when={meta(item)}>
                    <div class="text-12-regular text-text-weak truncate">{meta(item)}</div>
                  </Show>
                </div>
                <Show when={item.label === "Queued"}>
                  <IconButton
                    icon="close-small"
                    size="normal"
                    variant="ghost"
                    class="size-6 shrink-0"
                    onMouseDown={(event: MouseEvent) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={(event: MouseEvent) => {
                      event.stopPropagation()
                      remove(item.id)
                    }}
                    aria-label="Remove queued prompt"
                  />
                </Show>
              </div>
            )}
          </For>
          <Show when={hidden() > 0}>
            <div class="text-12-regular text-text-weak">... {hidden()} more</div>
          </Show>
        </div>
      </DockTray>
    </Show>
  )
}
