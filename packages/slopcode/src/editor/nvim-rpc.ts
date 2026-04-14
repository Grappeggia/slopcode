import * as net from "node:net"
import { Packr, Unpackr } from "msgpackr"

export namespace NvimRPC {
  type Handler = (params: unknown[]) => void

  export async function connect(file: string) {
    const packr = new Packr({ useRecords: false })
    const unpackr = new Unpackr({ useRecords: false, sequential: true })
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
    const handlers = new Map<string, Set<Handler>>()
    let id = 1
    let buffer = Buffer.alloc(0)

    const socket = net.createConnection(file)

    const handle = (message: unknown) => {
      if (!Array.isArray(message)) return
      const type = message[0]
      if (type === 1) {
        const hit = pending.get(Number(message[1]))
        if (!hit) return
        pending.delete(Number(message[1]))
        const err = message[2]
        if (err) {
          hit.reject(new Error(typeof err === "string" ? err : JSON.stringify(err)))
          return
        }
        hit.resolve(message[3])
        return
      }
      if (type === 2) {
        const set = handlers.get(String(message[1]))
        if (!set) return
        Array.from(set).forEach((item) => item(Array.isArray(message[2]) ? message[2] : []))
      }
    }

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)])
      try {
        let end = 0
        unpackr.unpackMultiple(buffer, (value, _start, finish) => {
          end = finish ?? end
          handle(value)
        })
        buffer = Buffer.alloc(0)
      } catch (error) {
        const last = typeof (error as { lastPosition?: unknown }).lastPosition === "number" ? Number((error as { lastPosition?: number }).lastPosition) : 0
        if (last > 0) buffer = buffer.slice(last)
        if ((error as { incomplete?: boolean }).incomplete) return
        close()
      }
    })

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve())
      socket.once("error", reject)
    })

    const close = () => {
      socket.end()
      socket.destroy()
      Array.from(pending.values()).forEach((item) => {
        item.reject(new Error("Neovim connection closed"))
      })
      pending.clear()
    }

    return {
      on(method: string, handler: Handler) {
        const set = handlers.get(method) ?? new Set<Handler>()
        set.add(handler)
        handlers.set(method, set)
        return () => {
          const hit = handlers.get(method)
          if (!hit) return
          hit.delete(handler)
          if (hit.size === 0) handlers.delete(method)
        }
      },
      notify(method: string, params: unknown[] = []) {
        socket.write(packr.pack([2, method, params]))
      },
      request(method: string, params: unknown[] = []) {
        const next = id++
        return new Promise<unknown>((resolve, reject) => {
          pending.set(next, { resolve, reject })
          socket.write(packr.pack([0, next, method, params]))
        })
      },
      close,
    }
  }
}
