import * as net from "node:net"
import { Packr, Unpackr } from "msgpackr"

export namespace NvimRPC {
  type Handler = (params: unknown[]) => void

  type Input = {
    on(event: "data", handler: (chunk: string | Buffer | Uint8Array) => void): unknown
    on(event: "close" | "end" | "error", handler: (error?: Error) => void): unknown
  }

  type Output = {
    write(data: Uint8Array | Buffer): unknown
    end?(): unknown
    destroy?(error?: Error): unknown
  }

  const create = (input: Input, output: Output, done: () => void) => {
    const packr = new Packr({ useRecords: false })
    const unpackr = new Unpackr({ useRecords: false, sequential: true })
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
    const handlers = new Map<string, Set<Handler>>()
    let id = 1
    let buffer = Buffer.alloc(0)
    let closed = false

    const close = () => {
      if (closed) return
      closed = true
      done()
      Array.from(pending.values()).forEach((item) => {
        item.reject(new Error("Neovim connection closed"))
      })
      pending.clear()
    }

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

    input.on("data", (chunk) => {
      const next = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      buffer = Buffer.concat([buffer, next])
      try {
        let end = 0
        unpackr.unpackMultiple(buffer, (value, _start, finish) => {
          end = finish ?? end
          handle(value)
        })
        buffer = Buffer.alloc(0)
      } catch (error) {
        const last =
          typeof (error as { lastPosition?: unknown }).lastPosition === "number"
            ? Number((error as { lastPosition?: number }).lastPosition)
            : 0
        if (last > 0) buffer = buffer.slice(last)
        if ((error as { incomplete?: boolean }).incomplete) return
        close()
      }
    })

    input.on("close", close)
    input.on("end", close)
    input.on("error", close)

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
        output.write(packr.pack([2, method, params]))
      },
      request(method: string, params: unknown[] = []) {
        const next = id++
        return new Promise<unknown>((resolve, reject) => {
          pending.set(next, { resolve, reject })
          output.write(packr.pack([0, next, method, params]))
        })
      },
      close,
    }
  }

  export function attach(input: Input, output: Output) {
    return create(input, output, () => {
      output.end?.()
      output.destroy?.()
    })
  }

  export async function connect(file: string) {
    const socket = net.createConnection(file)
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve())
      socket.once("error", reject)
    })
    return create(socket, socket, () => {
      socket.end()
      socket.destroy()
    })
  }
}
