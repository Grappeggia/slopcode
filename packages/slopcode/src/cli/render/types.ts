export type RichSegment =
  | {
      kind: "markdown"
      text: string
    }
  | {
      kind: "code"
      text: string
      filetype: string
    }
  | {
      kind: "plain"
      text: string
    }

export type RenderSegment = RichSegment & {
  id?: string
  streaming?: boolean
}

export type RichTextStream = {
  text: string
  boundary: number
  sealed: RenderSegment[]
  tail: RenderSegment[]
  next: number
}
