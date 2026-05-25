export type Style = {
  fg?: string
  bg?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

export type Segment = Style & {
  text: string
}

export type Diagnostic = {
  line: number
  column: number
  severity: "error" | "warning"
  message: string
}

export type Snapshot = {
  width: number
  height: number
  rows: Segment[][]
  mode: string
  dirty: boolean
  diff: boolean
  file: string
  status: string
  diagnostics: Diagnostic[]
}
