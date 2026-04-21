import { Log } from "@/util/log"
import { EditorSession as Basic } from "./session-basic"
import { EditorSessionNvim as Nvim } from "./session-nvim"

export namespace EditorSession {
  const log = Log.create({ service: "editor" })

  export const Info = Basic.Info
  export const OpenInput = Basic.OpenInput
  export const SnapshotData = Basic.SnapshotData
  export const ScopedInput = Basic.ScopedInput
  export const Event = Basic.Event

  const basic = () => process.env.SLOPCODE_EDITOR_FORCE_BASIC === "true"

  export async function open(input: Parameters<typeof Basic.open>[0]) {
    if (basic()) return Basic.open(input)
    if (await Nvim.supported()) {
      const hit = await Nvim.open(input).catch((error) => {
        log.warn("falling back to basic editor", { error, file: input.file })
      })
      if (hit) return hit
    }
    return Basic.open(input)
  }

  export function get(id: string, input?: Parameters<typeof Basic.get>[1]) {
    return Nvim.get(id, input) ?? Basic.get(id, input)
  }

  export async function snapshot(id: string, input?: Parameters<typeof Basic.snapshot>[1]) {
    return (await Nvim.snapshot(id, input)) ?? Basic.snapshot(id, input)
  }

  export async function resize(id: string, size: { rows: number; cols: number }, input?: Parameters<typeof Basic.resize>[2]) {
    return (await Nvim.resize(id, size, input)) ?? Basic.resize(id, size, input)
  }

  export async function save(id: string, input?: Parameters<typeof Basic.save>[1]) {
    return (await Nvim.save(id, input)) ?? Basic.save(id, input)
  }

  export async function dismiss(id: string, input?: Parameters<typeof Basic.dismiss>[1]) {
    return (await Nvim.dismiss(id, input)) ?? Basic.dismiss(id, input)
  }

  export async function close(id: string, input?: Parameters<typeof Basic.close>[1]) {
    const nvim = await Nvim.close(id, input)
    if (nvim) return true
    return Basic.close(id, input)
  }

  export function connect(id: string, ws: { readyState: number; data?: unknown; send(data: string | Uint8Array | ArrayBuffer): void; close(code?: number, reason?: string): void }, input?: Parameters<typeof Basic.connect>[2]) {
    return Nvim.connect(id, ws, input) ?? Basic.connect(id, ws, input)
  }
}
