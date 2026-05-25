// @refresh reload

import { iife } from "@slopcode-ai/util/iife"
import { product } from "@slopcode-ai/util/product"
import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface } from "@/app"
import { type Platform, PlatformProvider } from "@/context/platform"
import { dict as en } from "@/i18n/en"
import { dict as zh } from "@/i18n/zh"
import { handleNotificationClick } from "@/utils/notification-click"
import pkg from "../package.json"
import { ServerConnection } from "./context/server"

const DEFAULT_SERVER_URL_KEY = "slopcode.settings.dat:defaultServerUrl"

const getLocale = () => {
  if (typeof navigator !== "object") return "en" as const
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    if (!language) continue
    if (language.toLowerCase().startsWith("zh")) return "zh" as const
  }
  return "en" as const
}

const getRootNotFoundError = () => {
  const key = "error.dev.rootNotFound" as const
  const locale = getLocale()
  return locale === "zh" ? (zh[key] ?? en[key]) : en[key]
}

const getStorage = (key: string) => {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const setStorage = (key: string, value: string | null) => {
  if (typeof localStorage === "undefined") return
  try {
    if (value !== null) {
      localStorage.setItem(key, value)
      return
    }
    localStorage.removeItem(key)
  } catch {
    return
  }
}

const readDefaultServerUrl = () => getStorage(DEFAULT_SERVER_URL_KEY)
const writeDefaultServerUrl = (url: string | null) => setStorage(DEFAULT_SERVER_URL_KEY, url)

const viewID = (() => {
  const key = "slopcode.view-id"
  const ttl = 5_000
  const prefix = "slopcode.view-id.lease:"
  const owner = crypto.randomUUID()
  let cached = ""

  const read = (name: string) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  }

  const write = (name: string, value: string | null) => {
    try {
      if (value === null) {
        localStorage.removeItem(name)
        return
      }
      localStorage.setItem(name, value)
    } catch {
      return
    }
  }

  const active = (id: string) => {
    const raw = read(prefix + id)
    if (!raw) return false
    try {
      const lease = JSON.parse(raw) as { owner?: string; time?: number }
      if (lease.owner === owner) return false
      return typeof lease.time === "number" && Date.now() - lease.time < ttl
    } catch {
      return false
    }
  }

  const claim = (id: string) => {
    const renew = () => write(prefix + id, JSON.stringify({ owner, time: Date.now() }))
    const release = () => {
      const raw = read(prefix + id)
      if (!raw) return
      try {
        const lease = JSON.parse(raw) as { owner?: string }
        if (lease.owner === owner) write(prefix + id, null)
      } catch {
        return
      }
    }

    renew()
    window.setInterval(renew, Math.floor(ttl / 2))
    window.addEventListener("pagehide", release, { once: true })
    window.addEventListener("beforeunload", release, { once: true })
  }

  return () => {
    if (cached) return cached
    if (typeof sessionStorage === "undefined") {
      cached = crypto.randomUUID()
      return cached
    }
    const stored = sessionStorage.getItem(key)
    cached = stored && !active(stored) ? stored : crypto.randomUUID()
    sessionStorage.setItem(key, cached)
    claim(cached)
    return cached
  }
})()

const notify: Platform["notify"] = async (title, description, href) => {
  if (!("Notification" in window)) return

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission().catch(() => "denied")
      : Notification.permission

  if (permission !== "granted") return

  const inView = document.visibilityState === "visible" && document.hasFocus()
  if (inView) return

  const notification = new Notification(title, {
    body: description ?? "",
    icon: `${product.urls.site}/favicon-96x96-v3.png`,
  })

  notification.onclick = () => {
    handleNotificationClick(href)
    notification.close()
  }
}

const openLink: Platform["openLink"] = (url) => {
  window.open(url, "_blank")
}

const back: Platform["back"] = () => {
  window.history.back()
}

const forward: Platform["forward"] = () => {
  window.history.forward()
}

const restart: Platform["restart"] = async () => {
  window.location.reload()
}

const root = document.getElementById("root")
if (!(root instanceof HTMLElement) && import.meta.env.DEV) {
  throw new Error(getRootNotFoundError())
}

const platform: Platform = {
  platform: "web",
  version: pkg.version,
  viewID,
  openLink,
  back,
  forward,
  restart,
  notify,
  getDefaultServerUrl: async () => readDefaultServerUrl(),
  setDefaultServerUrl: writeDefaultServerUrl,
}

const defaultUrl = iife(() => {
  const lsDefault = readDefaultServerUrl()
  if (lsDefault) return lsDefault
  const host = new URL(product.urls.site).hostname
  if (location.hostname.includes(host)) return "http://localhost:4096"
  if (import.meta.env.DEV)
    return `http://${import.meta.env.VITE_SLOPCODE_SERVER_HOST ?? "localhost"}:${import.meta.env.VITE_SLOPCODE_SERVER_PORT ?? "4096"}`
  return location.origin
})

if (root instanceof HTMLElement) {
  const server: ServerConnection.Http = { type: "http", http: { url: defaultUrl } }
  render(
    () => (
      <PlatformProvider value={platform}>
        <AppBaseProviders>
          <AppInterface defaultServer={ServerConnection.key(server)} servers={[server]} />
        </AppBaseProviders>
      </PlatformProvider>
    ),
    root,
  )
}
