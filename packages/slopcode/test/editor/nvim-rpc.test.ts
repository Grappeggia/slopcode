import { afterEach, describe, expect, test } from "bun:test"
import * as net from "node:net"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Packr, Unpackr } from "msgpackr"
import { NvimRPC } from "../../src/editor/nvim-rpc"

const clean: string[] = []

afterEach(async () => {
  await Promise.all(clean.splice(0).map((file) => fs.rm(file, { force: true })))
})

describe("nvim rpc", () => {
  test("handles chunked responses and notifications", async () => {
    const sock = path.join(os.tmpdir(), `slopcode-nvim-rpc-${process.pid}-${Date.now()}.sock`)
    clean.push(sock)
    const packr = new Packr({ useRecords: false })
    const unpackr = new Unpackr({ useRecords: false, sequential: true })
    const seen: unknown[][] = []

    const server = net.createServer((socket) => {
      socket.on("data", (chunk) => {
        unpackr.unpackMultiple(Buffer.from(chunk), (value) => {
          if (!Array.isArray(value) || value[0] !== 0) return
          seen.push(value as unknown[])
          const response = packr.pack([1, value[1], null, { ok: true }])
          socket.write(response.subarray(0, 3))
          setTimeout(() => socket.write(response.subarray(3)), 10)
          setTimeout(() => socket.write(packr.pack([2, "redraw", [["flush", []]]])), 20)
        })
      })
    })

    await new Promise<void>((resolve) => server.listen(sock, resolve))
    const rpc = await NvimRPC.connect(sock)
    const calls: unknown[][] = []
    const off = rpc.on("redraw", (params) => calls.push(params))

    const result = await rpc.request("nvim_eval", ["1 + 1"])
    expect(result).toEqual({ ok: true })
    await Bun.sleep(40)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.[2]).toBe("nvim_eval")
    expect(calls).toEqual([[["flush", []]]])

    off()
    rpc.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test("rejects pending requests when the socket closes", async () => {
    const sock = path.join(os.tmpdir(), `slopcode-nvim-rpc-${process.pid}-${Date.now()}-close.sock`)
    clean.push(sock)
    const unpackr = new Unpackr({ useRecords: false, sequential: true })

    const server = net.createServer((socket) => {
      socket.on("data", (chunk) => {
        unpackr.unpackMultiple(Buffer.from(chunk), (value) => {
          if (!Array.isArray(value) || value[0] !== 0) return
          socket.end()
        })
      })
    })

    await new Promise<void>((resolve) => server.listen(sock, resolve))
    const rpc = await NvimRPC.connect(sock)
    await expect(rpc.request("nvim_eval", ["1 + 1"])).rejects.toThrow("Neovim connection closed")
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
})
