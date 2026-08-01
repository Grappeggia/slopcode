import type { RemoteWorkspaceState } from "./remote-workspace-state"
import { shellBridge, readInitialWorkspaceState } from "./platform"

const root = document.getElementById("root")
if (!(root instanceof HTMLElement)) throw new Error("Android root not found")
const mount = root

const bridge = shellBridge()

function row(label: string, value: string) {
  const item = document.createElement("div")
  item.style.marginBottom = "8px"
  item.textContent = `${label}: ${value}`
  return item
}

function renderLaunch(state: { serverUrl?: string; pairing?: { name?: string } & Record<string, unknown> }) {
  mount.innerHTML = ""
  Object.assign(mount.style, {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b1020",
    color: "#e5e7eb",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: "24px",
    boxSizing: "border-box",
  })

  const card = document.createElement("div")
  Object.assign(card.style, {
    width: "100%",
    maxWidth: "420px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.92)",
    padding: "24px",
    boxSizing: "border-box",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
  })

  const title = document.createElement("h1")
  title.textContent = "Android shell ready"
  title.style.margin = "0 0 12px"
  title.style.fontSize = "24px"
  card.append(title)

  const text = document.createElement("p")
  text.textContent = "This native shell is waiting for a persisted remote workspace target."
  text.style.margin = "0 0 20px"
  text.style.color = "#94a3b8"
  card.append(text)

  const list = document.createElement("div")
  list.append(
    row("Secure storage", bridge.capabilities.secureStorage ? "on" : "off"),
    row("QR pairing", bridge.capabilities.qrPairing ? "on" : "off"),
    row("Notifications", bridge.capabilities.notifications ? "on" : "off"),
    row("Deep links", bridge.capabilities.deepLinks ? "on" : "off"),
    row("Remote transport", bridge.capabilities.remoteTransport ? "on" : "off"),
  )
  card.append(list)

  if (state.serverUrl) card.append(row("Persisted server", state.serverUrl))
  if (state.pairing?.name && typeof state.pairing.name === "string") card.append(row("Persisted workspace", state.pairing.name))

  mount.append(card)
}

async function main() {
  const state = (await readInitialWorkspaceState()) as RemoteWorkspaceState
  if (state.serverUrl) {
    window.location.replace(state.serverUrl)
    return
  }
  renderLaunch(state)
}

void main()
