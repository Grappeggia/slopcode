export type SlashTrigger = {
  start: number
  end: number
  query: string
  token: string
}

export type SlashRemoval = {
  start: number
  end: number
  text: string
  cursor: number
}

const isWhitespace = (char?: string) => char !== undefined && /\s/.test(char)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const tokenEnd = (input: string, start: number) => {
  let end = start
  while (end < input.length && !isWhitespace(input[end])) end += 1
  return end
}

export function findSlashTrigger(input: string, cursor = input.length): SlashTrigger | undefined {
  const offset = clamp(cursor, 0, input.length)
  let start = offset

  while (start > 0 && !isWhitespace(input[start - 1])) start -= 1

  const token = input.slice(start, offset)
  if (!token.startsWith("/")) return
  if (token.slice(1).includes("/")) return

  return {
    start,
    end: tokenEnd(input, start),
    query: token.slice(1),
    token,
  }
}

export function removeSlashTrigger(input: string, trigger: SlashTrigger): SlashRemoval {
  let end = trigger.end
  if ((input[end] === " " || input[end] === "\t") && (trigger.start === 0 || isWhitespace(input[trigger.start - 1]))) {
    end += 1
  }

  return {
    start: trigger.start,
    end,
    text: input.slice(0, trigger.start) + input.slice(end),
    cursor: trigger.start,
  }
}
