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

requestAnimationFrame(() => {
  document.querySelector<HTMLButtonElement>("[data-ssh-menu-toggle]")?.click()
  const drawer = document.querySelector<HTMLElement>("[data-ssh-drawer]")
  document.body.dataset.drawerOpen = drawer?.getAttribute("data-ssh-drawer-open") ?? ""
  document.body.dataset.ariaHidden = drawer?.getAttribute("aria-hidden") ?? ""
  document.body.dataset.inert = drawer?.hasAttribute("inert") ? "true" : "false"
  document.body.dataset.back = window.__slopcodeAndroidBack?.() ? "handled" : "unhandled"
  document.body.dataset.closed = drawer?.getAttribute("aria-hidden") ?? ""
})
