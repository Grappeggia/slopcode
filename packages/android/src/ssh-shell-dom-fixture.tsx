import { render } from "solid-js/web"
import { installAndroidBack } from "./android-back"
import { SshShell } from "./ssh-shell"

const root = document.getElementById("root")
if (!root) throw new Error("SSH shell DOM fixture root is unavailable")

render(
  () => (
    <SshShell>
      <p>SSH shell DOM fixture</p>
    </SshShell>
  ),
  root,
)

installAndroidBack(() => false)

queueMicrotask(() => {
  const menu = document.querySelector<HTMLButtonElement>("[data-ssh-menu-toggle]")
  const content = document.querySelector<HTMLElement>("[data-ssh-shell-content]")
  menu?.focus()
  menu?.click()
  queueMicrotask(() => {
    const drawer = document.querySelector<HTMLElement>("[data-ssh-drawer]")
    const close = drawer?.querySelector<HTMLButtonElement>('[aria-label="Close navigation"]')
    document.body.dataset.drawerOpen = drawer?.getAttribute("data-ssh-drawer-open") ?? ""
    document.body.dataset.ariaHidden = drawer?.getAttribute("aria-hidden") ?? ""
    document.body.dataset.ariaModal = drawer?.getAttribute("aria-modal") ?? ""
    document.body.dataset.inert = drawer?.hasAttribute("inert") ? "true" : "false"
    document.body.dataset.contentHidden = content?.getAttribute("aria-hidden") ?? ""
    document.body.dataset.contentInert = content?.hasAttribute("inert") ? "true" : "false"
    document.body.dataset.openFocus = document.activeElement?.getAttribute("aria-label") ?? ""
    close?.focus()
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
    )
    document.body.dataset.trapFocus =
      document.activeElement?.getAttribute("data-ssh-theme-toggle") === "" ? "theme" : ""
    document.body.dataset.back = window.__slopcodeAndroidBack?.() ? "handled" : "unhandled"
    queueMicrotask(() => {
      document.body.dataset.closedOpen = drawer?.getAttribute("data-ssh-drawer-open") ?? ""
      document.body.dataset.closedHidden = drawer?.getAttribute("aria-hidden") ?? ""
      document.body.dataset.closedInert = drawer?.hasAttribute("inert") ? "true" : "false"
      document.body.dataset.closedContentHidden = content?.getAttribute("aria-hidden") ?? ""
      document.body.dataset.closedContentInert = content?.hasAttribute("inert") ? "true" : "false"
      document.body.dataset.closedFocus = document.activeElement?.getAttribute("aria-label") ?? ""
      document.body.dataset.menuHidden = menu?.getAttribute("aria-hidden") ?? ""
      document.body.dataset.menuInert = menu?.hasAttribute("inert") ? "true" : "false"
    })
  })
})
