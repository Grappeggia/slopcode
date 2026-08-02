import { createSignal } from "solid-js"
import { syncWindowFullscreen } from "./window-fullscreen-sync"

const [windowFullscreen, setWindowFullscreen] = createSignal(false)
const clear = syncWindowFullscreen(window.api, setWindowFullscreen)

window.addEventListener("beforeunload", clear, { once: true })

export { windowFullscreen }
