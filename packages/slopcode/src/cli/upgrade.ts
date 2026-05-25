import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Flag } from "@/flag/flag"
import { Installation } from "@/installation"

export async function upgrade() {
  const config = await Config.global()
  const method = await Installation.method()
  const latest = await Installation.latest(method).catch(() => {})
  if (!latest) return
  if (Installation.VERSION === latest) return

  if (config.autoupdate === false || Flag.SLOPCODE_DISABLE_AUTOUPDATE) {
    return
  }
  if (config.autoupdate === "notify") {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
    return
  }

  if (method === "unknown") return
  if (method === "yarn") {
    const yarn = await Installation.yarnContext().catch(() => ({ mode: "unknown" as const }))
    if (yarn.mode !== "classic") {
      await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
      return
    }
  }
  if (
    method === "apt" ||
    method === "zypper" ||
    method === "dnf" ||
    method === "yum" ||
    method === "apk" ||
    method === "pkg" ||
    method === "macports" ||
    method === "pacman" ||
    method === "paru" ||
    method === "snap"
  ) {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
    return
  }
  await Installation.upgrade(method, latest)
    .then(() => Bus.publish(Installation.Event.Updated, { version: latest }))
    .catch(() => {})
}
