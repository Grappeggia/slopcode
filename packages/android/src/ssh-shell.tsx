import { createEffect, createSignal, onCleanup, onMount, Show, type JSX } from "solid-js"
import { getAndroidBridge } from "./bridge"
import type { SshWorkspaceState } from "./ssh-workspace-state"
import "./ssh-shell.css"

export type SshColorScheme = "light" | "dark"

type Props = {
  children: JSX.Element
  workspace?: Pick<SshWorkspaceState, "target" | "directory" | "agent">
  sessionID?: string
  sessionState?: string
}

const STORAGE_KEY = "slopcode.android.ssh.color-scheme"

function readScheme(): SshColorScheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function writeScheme(value: SshColorScheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {}
}

function name(value: SshWorkspaceState["agent"] | undefined) {
  if (value === "codex-cli") return "Codex"
  if (value === "opencode-cli") return "OpenCode"
  if (value === "antigravity-cli") return "Antigravity"
  return "Claude Code"
}

export function SshShell(props: Props) {
  const [scheme, setScheme] = createSignal<SshColorScheme>(readScheme())
  const [open, setOpen] = createSignal(false)
  let menu: HTMLButtonElement | undefined
  let drawer: HTMLElement | undefined
  let returnFocus: HTMLElement | undefined
  let wasOpen = false

  const syncInsets = async () => {
    const bridge = getAndroidBridge()
    if (!bridge?.systemInsets) return
    const raw = await bridge.systemInsets().catch(() => undefined)
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return
    const value = raw as Record<string, unknown>
    const scale = Math.max(1, window.devicePixelRatio || 1)
    const px = (key: string) => {
      const next = value[key]
      return `${typeof next === "number" && Number.isFinite(next) ? next / scale : 0}px`
    }
    document.documentElement.style.setProperty("--android-inset-top", px("top"))
    document.documentElement.style.setProperty("--android-inset-right", px("right"))
    document.documentElement.style.setProperty("--android-inset-bottom", px("bottom"))
    document.documentElement.style.setProperty("--android-inset-left", px("left"))
    document.documentElement.style.setProperty("--android-ime-bottom", px("imeBottom"))
  }

  onMount(() => {
    void syncInsets()
    const refresh = () => void syncInsets()
    window.addEventListener("resize", refresh)
    window.addEventListener("orientationchange", refresh)
    window.visualViewport?.addEventListener("resize", refresh)
    const keydown = (event: KeyboardEvent) => {
      if (!open()) return
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab" || !drawer) return
      const items = [
        ...drawer.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])"),
      ].filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-hidden") !== "true")
      if (!items.length) return
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault()
        items[0]?.focus()
        return
      }
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault()
        items.at(-1)?.focus()
        return
      }
      if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault()
        items[0]?.focus()
      }
    }
    document.addEventListener("keydown", keydown)
    onCleanup(() => {
      window.removeEventListener("resize", refresh)
      window.removeEventListener("orientationchange", refresh)
      window.visualViewport?.removeEventListener("resize", refresh)
      document.removeEventListener("keydown", keydown)
    })
  })

  createEffect(() => {
    const value = open()
    if (value) {
      returnFocus =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : menu
      queueMicrotask(() => {
        if (!open()) return
        drawer
          ?.querySelector<HTMLElement>("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])")
          ?.focus()
      })
    } else if (wasOpen) {
      returnFocus?.focus()
      returnFocus = undefined
    }
    wasOpen = value
  })

  createEffect(() => {
    const value = scheme()
    document.documentElement.dataset.colorScheme = value
    document.documentElement.style.colorScheme = value
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", value === "dark" ? "#111318" : "#f7f7fb")
    void getAndroidBridge()
      ?.setSystemBars?.(value === "dark")
      .catch(() => undefined)
    writeScheme(value)
  })

  const toggle = () => setScheme((value) => (value === "dark" ? "light" : "dark"))

  return (
    <div data-ssh-shell data-ssh-theme={scheme()} class="min-h-[100dvh]">
      <button
        type="button"
        aria-label={open() ? "Close navigation" : "Open navigation"}
        aria-expanded={open()}
        aria-hidden={open() ? "true" : undefined}
        inert={open()}
        onClick={() => setOpen((value) => !value)}
        ref={(node) => (menu = node)}
        data-ssh-menu-toggle
        class="fixed z-40 flex h-12 w-12 items-center justify-center rounded-xl border border-border-weak-base bg-surface-raised-base text-16-medium shadow-md"
      >
        {open() ? "×" : "☰"}
      </button>

      <Show when={open()}>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          tabIndex={-1}
          aria-hidden="true"
          class="fixed inset-0 z-40 bg-black/45"
        />
      </Show>

      <aside
        ref={(node) => (drawer = node)}
        data-ssh-drawer
        data-ssh-drawer-open={open() ? "true" : undefined}
        aria-label="Slopcode navigation"
        aria-hidden={!open()}
        aria-modal={open() ? "true" : undefined}
        inert={!open()}
        role="dialog"
        class={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r border-border-weak-base bg-background-strong p-4 shadow-lg ${open() ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div class="flex items-center justify-between gap-3 border-b border-border-weak-base pb-4 pl-14">
          <div>
            <p class="text-16-medium">Slopcode</p>
            <p class="text-12-regular text-text-weak">Remote workspace</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            class="min-h-12 min-w-12 rounded-md px-3 py-2 text-16-medium"
          >
            ×
          </button>
        </div>

        <nav class="flex flex-1 flex-col gap-5 py-5" aria-label="Session navigation">
          <section class="flex flex-col gap-2" aria-labelledby="active-sessions-label">
            <p id="active-sessions-label" class="text-12-regular uppercase tracking-wide text-text-weak">
              Active sessions
            </p>
            <Show
              when={props.sessionID}
              fallback={
                <p class="rounded-lg border border-border-weak-base px-3 py-3 text-12-regular text-text-weak">
                  No active sessions
                </p>
              }
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-ssh-active-session={props.sessionID}
                class="min-h-12 rounded-lg border border-border-brand-base bg-surface-base px-3 py-3 text-left"
              >
                <span class="block text-14-medium">{name(props.workspace?.agent)} session</span>
                <span class="mt-1 block truncate text-12-regular text-text-weak">
                  {props.workspace?.directory ?? "Remote workspace"}
                </span>
                <span class="mt-2 block text-12-regular text-text-weak">{props.sessionState ?? "Active"}</span>
              </button>
            </Show>
          </section>

          <section class="flex flex-col gap-2" aria-labelledby="computer-label">
            <p id="computer-label" class="text-12-regular uppercase tracking-wide text-text-weak">
              Computer
            </p>
            <div class="rounded-lg border border-border-weak-base px-3 py-3">
              <p class="truncate text-14-medium">{props.workspace?.target ?? "No computer selected"}</p>
              <p class="mt-1 truncate text-12-regular text-text-weak">
                {props.workspace?.directory ?? "Choose a workspace"}
              </p>
            </div>
          </section>
        </nav>

        <div class="border-t border-border-weak-base pt-4">
          <button
            type="button"
            aria-pressed={scheme() === "dark"}
            onClick={toggle}
            data-ssh-theme-toggle
            class="flex min-h-12 w-full items-center justify-between rounded-lg border border-border-weak-base px-3 py-3 text-left"
          >
            <span>
              <span class="block text-14-medium">{scheme() === "dark" ? "Dark mode" : "Light mode"}</span>
              <span class="block text-12-regular text-text-weak">Appearance is saved on this device</span>
            </span>
            <span aria-hidden="true" class="text-16-medium">
              {scheme() === "dark" ? "☾" : "☀"}
            </span>
          </button>
        </div>
      </aside>

      <div data-ssh-shell-content aria-hidden={open()} inert={open()}>
        {props.children}
      </div>
    </div>
  )
}
