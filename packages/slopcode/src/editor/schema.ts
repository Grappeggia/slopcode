import { Identifier } from "@/id/id"
import z from "zod"

export const Info = z
  .object({
    id: z.string(),
    sessionID: Identifier.schema("session"),
    file: z.string(),
    cwd: z.string(),
    status: z.enum(["running", "exited"]),
    dirty: z.boolean(),
    diff: z.boolean(),
    mode: z.string(),
    pid: z.number(),
  })
  .meta({ ref: "EditorSession" })

export const OpenInput = z.object({
  sessionID: Identifier.schema("session"),
  file: z.string(),
  size: z.object({ rows: z.number().int().positive(), cols: z.number().int().positive() }),
})

export const SnapshotData = z.object({
  width: z.number(),
  height: z.number(),
  rows: z.array(
    z.array(
      z.object({
        text: z.string(),
        fg: z.string().optional(),
        bg: z.string().optional(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.boolean().optional(),
        strikethrough: z.boolean().optional(),
      }),
    ),
  ),
  mode: z.string(),
  dirty: z.boolean(),
  diff: z.boolean(),
  file: z.string(),
  status: z.string(),
  diagnostics: z.array(
    z.object({
      line: z.number(),
      column: z.number(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
    }),
  ),
})

export const ScopedInput = z.object({
  sessionID: Identifier.schema("session"),
})
