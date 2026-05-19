export const VERSION = 1

type Base = {
  version: typeof VERSION
}

export type HostHello = Base & {
  type: "hello"
}

export type HostFrame = Base & {
  type: "frame"
  seq: number
  width: number
  height: number
  text: string
}

export type HostInput = Base & {
  type: "input"
  data: string
}

export type HostResize = Base & {
  type: "resize"
  width: number
  height: number
}

export type HostExit = Base & {
  type: "exit"
  code: number
}

export type HostMessage = HostHello | HostFrame | HostInput | HostResize | HostExit

function object(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null
}

function number(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input)
}

function string(input: unknown): input is string {
  return typeof input === "string"
}

export function message(input: unknown): HostMessage | undefined {
  if (!object(input) || input.version !== VERSION || !string(input.type)) return
  if (input.type === "hello") return { type: input.type, version: VERSION }
  if (
    input.type === "frame" &&
    number(input.seq) &&
    number(input.width) &&
    number(input.height) &&
    string(input.text)
  ) {
    return {
      type: input.type,
      version: VERSION,
      seq: input.seq,
      width: input.width,
      height: input.height,
      text: input.text,
    }
  }
  if (input.type === "input" && string(input.data)) return { type: input.type, version: VERSION, data: input.data }
  if (input.type === "resize" && number(input.width) && number(input.height)) {
    return { type: input.type, version: VERSION, width: input.width, height: input.height }
  }
  if (input.type === "exit" && number(input.code)) return { type: input.type, version: VERSION, code: input.code }
}

export function encode(input: HostMessage) {
  return JSON.stringify(input) + "\n"
}

export function decode(line: string) {
  const parsed = (() => {
    try {
      return JSON.parse(line) as unknown
    } catch {
      return
    }
  })()
  return message(parsed)
}
