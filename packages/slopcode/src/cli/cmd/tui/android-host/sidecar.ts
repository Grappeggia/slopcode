import { spawn } from "child_process"
import { encode, type HostFrame } from "./protocol"

export function frame(input: { seq?: number; width?: number; height?: number; text: string }): HostFrame {
  return {
    type: "frame",
    version: 1,
    seq: input.seq ?? 1,
    width: input.width ?? process.stdout.columns ?? 80,
    height: input.height ?? process.stdout.rows ?? 24,
    text: input.text,
  }
}

export async function run(input: { path: string; text: string }) {
  const child = spawn(input.path, [], { stdio: ["pipe", "inherit", "inherit"] })
  child.stdin.write(encode({ type: "hello", version: 1 }))
  child.stdin.write(encode(frame({ text: input.text })))
  child.stdin.write(encode({ type: "exit", version: 1, code: 0 }))
  child.stdin.end()
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Android host sidecar exited with ${code ?? "signal"}`))
    })
  })
}
