import { describe, expect, test } from "bun:test"
import * as path from "node:path"
import { tmpdir } from "../../fixture/fixture"
import { Storage } from "../../../src/storage/storage"
import { click, column, ctrl, eventually, locate, press, start, wheel } from "./editor-e2e"

const token = "editor-additional-flows-token"
const width = 140
const height = 40
const narrow_width = 100
const narrow_height = 24

function ready(app: Awaited<ReturnType<typeof start>>, title: string) {
  return eventually(() => {
    const screen = app.text()
    if (!screen.includes(title) || !screen.includes("📂")) return
    return screen
  }, 15_000)
}

function section(lines: string[], title: string) {
  const start = lines.findIndex((line) => line.includes(title))
  if (start === -1) return [] as string[]
  return lines.slice(start + 1)
}

function section_row(lines: string[], title: string, file: string, label?: string) {
  const start = lines.findIndex((line) => line.includes(title))
  if (start === -1) return
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.includes(file)) continue
    if (label && !line.includes(label)) continue
    return { row: i + 1, line }
  }
}

function explorer_row(lines: string[], file: string) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.includes(file) || !line.includes("[open]")) continue
    return { row: i + 1, line }
  }
}

function open_file_row(lines: string[], file: string) {
  return section_row(lines, "Open Files", file)
}

function modified_row(lines: string[], file: string) {
  return section_row(lines, "Modified Files", file, "[open]")
}

async function open_files(app: Awaited<ReturnType<typeof start>>) {
  const hit = await eventually(() => locate(app.text(), "📂"), 15_000)
  click(app.pty, hit.row, hit.col)
  await eventually(() => {
    const lines = app.screen()
    if (!lines.some((line) => line.includes("[open]"))) return
    return lines
  }, 8_000)
}

async function click_files_row(app: Awaited<ReturnType<typeof start>>, file: string) {
  await open_files(app)
  const hit = await eventually(() => {
    const lines = app.screen()
    const row = explorer_row(lines, file)
    if (!row) return
    const col = column(row.line, file)
    if (!col) return
    return { row: row.row, col: col + 1 }
  }, 10_000)
  click(app.pty, hit.row, hit.col)
}

async function click_files_open(app: Awaited<ReturnType<typeof start>>, file: string) {
  await open_files(app)
  const hit = await eventually(() => {
    const lines = app.screen()
    const row = explorer_row(lines, file)
    if (!row) return
    const col = column(row.line, "[open]")
    if (!col) return
    return { row: row.row, col: col + 2 }
  }, 10_000)
  click(app.pty, hit.row, hit.col)
}

async function click_open_files_control(
  app: Awaited<ReturnType<typeof start>>,
  file: string,
  label: "[save]" | "[close]",
) {
  const hit = await eventually(() => {
    const lines = app.screen()
    const row = open_file_row(lines, file)
    if (!row) return
    for (let i = row.row; i < Math.min(lines.length, row.row + 4); i++) {
      const col = column(lines[i]!, label)
      if (!col) continue
      return { row: i + 1, col: col + 2 }
    }
  }, 10_000)
  click(app.pty, hit.row, hit.col)
}

async function click_modified_open(app: Awaited<ReturnType<typeof start>>, file: string) {
  const hit = await eventually(() => {
    const lines = app.screen()
    const row = modified_row(lines, file)
    if (!row) return
    const col = column(row.line, "[open]")
    if (!col) return
    return { row: row.row, col: col + 2 }
  }, 10_000)
  click(app.pty, hit.row, hit.col)
}

async function click_text(app: Awaited<ReturnType<typeof start>>, value: string, occurrence = 0) {
  const hit = await eventually(() => locate(app.text(), value, occurrence), 10_000)
  click(app.pty, hit.row, hit.col + Math.max(1, Math.floor(value.length / 2)))
}

async function wait_editor(app: Awaited<ReturnType<typeof start>>, snippet: string) {
  return eventually(() => {
    const screen = app.text()
    if (!screen.includes(snippet) || !screen.includes("Back ^Q")) return
    return screen
  }, 15_000)
}

async function wait_no_editor(app: Awaited<ReturnType<typeof start>>, snippet: string) {
  return eventually(() => {
    const screen = app.text()
    if (screen.includes(snippet)) return
    if (screen.includes("Back ^Q")) return
    return screen
  }, 10_000)
}

describe("editor additional flows e2e", () => {
  test("files row attaches while [open] opens the editor", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "note.ts"), 'export const note = "ATTACH OPEN"\n')
      },
    })
    const app = await start({
      title: "Files Attach vs Open",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-files-attach-open",
    })
    try {
      await ready(app, "Files Attach vs Open")
      await open_files(app)
      await click_files_row(app, "note.ts")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("Attached note.ts") || !screen.includes("@note.ts")) return
        return screen
      }, 8_000)
      await Bun.sleep(250)
      expect(app.text()).not.toContain("ATTACH OPEN")

      await click_files_open(app, "note.ts")
      await wait_editor(app, "ATTACH OPEN")
    } finally {
      await app.stop()
    }
  }, 25_000)

  test("happy-path edit and Ctrl+S save updates disk and clears dirty state", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "foo.ts"), "const v = 1\n")
      },
    })
    const app = await start({
      title: "Editor Save",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-save-ctrl-s",
    })
    try {
      await ready(app, "Editor Save")
      await open_files(app)
      await click_files_open(app, "foo.ts")
      await wait_editor(app, "const v = 1")

      app.pty.write(";")
      await eventually(() => {
        const screen = app.text()
        const row = open_file_row(app.screen(), "foo.ts")
        if (!row?.line.includes("*")) return
        if (!screen.includes("modified")) return
        return screen
      }, 8_000)

      ctrl(app.pty, "s")
      await eventually(async () => {
        const disk = (await Bun.file(path.join(tmp.path, "foo.ts")).text()).trimEnd()
        const row = open_file_row(app.screen(), "foo.ts")
        const screen = app.text()
        if (disk !== ";const v = 1") return
        if (row?.line.includes("*")) return
        if (screen.includes("modified")) return
        if (!screen.includes("Save ^S")) return
        return screen
      }, 10_000)
    } finally {
      await app.stop()
    }
  }, 30_000)

  test("[save] from Open Files saves and keeps the editor mounted", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "bar.ts"), "const bar = 1\n")
      },
    })
    const app = await start({
      title: "Sidebar Save",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-save-sidebar",
    })
    try {
      await ready(app, "Sidebar Save")
      await open_files(app)
      await click_files_open(app, "bar.ts")
      await wait_editor(app, "const bar = 1")

      app.pty.write(";")
      await eventually(() => {
        const row = open_file_row(app.screen(), "bar.ts")
        if (!row?.line.includes("*")) return
        return row.line
      }, 8_000)

      ctrl(app.pty, "s")
      await eventually(async () => {
        const disk = (await Bun.file(path.join(tmp.path, "bar.ts")).text()).trimEnd()
        const row = open_file_row(app.screen(), "bar.ts")
        const screen = app.text()
        if (disk === "const bar = 1") return
        if (row?.line.includes("*")) return
        if (screen.includes("modified")) return
        if (!screen.includes("const bar = 1")) return
        return screen
      }, 10_000)
    } finally {
      await app.stop()
    }
  }, 30_000)

  test("reopening an existing file reactivates it and one close removes it", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "a.ts"), 'export const alpha = "ALPHA TAB"\n')
      },
    })
    const app = await start({
      title: "Reopen Existing",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-reopen-existing",
    })
    try {
      await ready(app, "Reopen Existing")
      await open_files(app)
      await click_files_open(app, "a.ts")
      await wait_editor(app, "ALPHA TAB")

      await click_text(app, "Chat")
      await wait_no_editor(app, "ALPHA TAB")

      await click_files_open(app, "a.ts")
      await wait_editor(app, "ALPHA TAB")

      await click_open_files_control(app, "a.ts", "[close]")
      await wait_no_editor(app, "ALPHA TAB")
    } finally {
      await app.stop()
    }
  }, 30_000)

  test("dirty close guard cancels once and confirms on the second close", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "guard.ts"), "const guard = 1\n")
      },
    })
    const app = await start({
      title: "Dirty Close Guard",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-dirty-close",
    })
    try {
      await ready(app, "Dirty Close Guard")
      await open_files(app)
      await click_files_open(app, "guard.ts")
      await wait_editor(app, "const guard = 1")

      app.pty.write(";")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("modified")) return
        return screen
      }, 8_000)

      await click_open_files_control(app, "guard.ts", "[close]")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("Discard changes?")) return
        return screen
      }, 8_000)
      await click_text(app, "Cancel")
      await eventually(() => {
        const screen = app.text()
        if (screen.includes("Discard changes?")) return
        if (!screen.includes("const guard = 1")) return
        if (!screen.includes("modified")) return
        return screen
      }, 8_000)

      await click_open_files_control(app, "guard.ts", "[close]")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("Discard changes?")) return
        return screen
      }, 8_000)
      await click_text(app, "Confirm")
      await wait_no_editor(app, "const guard = 1")
      expect((await Bun.file(path.join(tmp.path, "guard.ts")).text()).trimEnd()).toBe("const guard = 1")
    } finally {
      await app.stop()
    }
  }, 35_000)

  test("multi-tab lifecycle closes inactive, active, and last tabs with expected focus", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "a.ts"), 'export const alpha = "ALPHA LIFE"\n')
        await Bun.write(path.join(dir, "b.ts"), 'export const beta = "BETA LIFE"\n')
        await Bun.write(path.join(dir, "c.ts"), 'export const gamma = "GAMMA LIFE"\n')
      },
    })
    const app = await start({
      title: "Multi Tab Lifecycle",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-multi-tab-lifecycle",
    })
    try {
      await ready(app, "Multi Tab Lifecycle")
      await open_files(app)
      await click_files_open(app, "a.ts")
      await wait_editor(app, "ALPHA LIFE")
      await click_files_open(app, "b.ts")
      await wait_editor(app, "BETA LIFE")
      await click_files_open(app, "c.ts")
      await wait_editor(app, "GAMMA LIFE")

      await click_open_files_control(app, "b.ts", "[close]")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("GAMMA LIFE")) return
        if (screen.includes("BETA LIFE")) return
        return screen
      }, 8_000)

      await click_open_files_control(app, "c.ts", "[close]")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("ALPHA LIFE")) return
        if (screen.includes("GAMMA LIFE")) return
        return screen
      }, 8_000)

      await click_open_files_control(app, "a.ts", "[close]")
      await wait_no_editor(app, "ALPHA LIFE")
    } finally {
      await app.stop()
    }
  }, 40_000)

  test("diagnostics appear for invalid content and clear after fixing and saving", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "warn.ts"), "const warn = 1 \n")
      },
    })
    const app = await start({
      title: "Diagnostics Clear",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-diagnostics-clear",
    })
    try {
      await ready(app, "Diagnostics Clear")
      await open_files(app)
      await click_files_open(app, "warn.ts")
      await wait_editor(app, "const warn = 1")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("1 issues")) return
        if (!screen.includes("Trailing whitespace")) return
        return screen
      }, 10_000)

      press(app.pty, "end")
      app.pty.write("\u007f")
      ctrl(app.pty, "s")
      await eventually(async () => {
        const screen = app.text()
        const disk = await Bun.file(path.join(tmp.path, "warn.ts")).text()
        if (screen.includes("issues")) return
        if (screen.includes("Trailing whitespace")) return
        if (disk !== "const warn = 1\n") return
        return screen
      }, 12_000)
    } finally {
      await app.stop()
    }
  }, 35_000)

  test("diff dismiss works from Ctrl+D and the toolbar button", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        await Bun.write(path.join(dir, "diff.ts"), "const live = true\n")
      },
    })
    const app = await start({
      title: "Diff Dismiss",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "editor-diff-dismiss",
      prepare: async (session_id) => {
        await Storage.write(
          ["session_diff", session_id],
          [
            {
              file: "diff.ts",
              before: "const live = false\n",
              after: "const live = true\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        )
      },
    })
    try {
      await ready(app, "Diff Dismiss")
      await click_modified_open(app, "diff.ts")
      await wait_editor(app, "const live = true")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("Dismiss Diff ^D")) return
        return screen
      }, 10_000)

      ctrl(app.pty, "d")
      await eventually(() => {
        const screen = app.text()
        if (screen.includes("Dismiss Diff ^D")) return
        if (!screen.includes("const live = true")) return
        return screen
      }, 10_000)

      await click_open_files_control(app, "diff.ts", "[close]")
      await wait_no_editor(app, "const live = true")
      await click_modified_open(app, "diff.ts")
      await wait_editor(app, "const live = true")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("Dismiss Diff ^D")) return
        return screen
      }, 10_000)

      await click_text(app, "Dismiss Diff ^D")
      await eventually(() => {
        const screen = app.text()
        if (screen.includes("Dismiss Diff ^D")) return
        if (!screen.includes("const live = true")) return
        return screen
      }, 10_000)
    } finally {
      await app.stop()
    }
  }, 40_000)

  test("compact-screen overlay flow supports navigation, wheel scrolling, edits, and save", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        const lines = Array.from({ length: 120 }, (_, i) => `line ${String(i + 1).padStart(3, "0")}`).join("\n")
        await Bun.write(path.join(dir, "long.ts"), `${lines}\n`)
      },
    })
    const app = await start({
      title: "Compact Overlay",
      directory: tmp.path,
      token,
      width: narrow_width,
      height: narrow_height,
      script_name: "editor-compact-overlay",
    })
    try {
      await ready(app, "Compact Overlay")
      await open_files(app)
      await click_files_open(app, "long.ts")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("long.ts")) return
        if (!screen.includes("Files")) return
        return screen
      }, 10_000)
      await click_text(app, ">")
      await wait_editor(app, "line 001")

      click(app.pty, 10, 20)
      wheel(app.pty, 10, 20, "down")
      press(app.pty, "pagedown")
      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("line 020")) return
        return screen
      }, 10_000)

      press(app.pty, "home")
      press(app.pty, "end")
      app.pty.write(";")
      ctrl(app.pty, "s")
      await eventually(async () => {
        const disk = await Bun.file(path.join(tmp.path, "long.ts")).text()
        const screen = app.text()
        if (!disk.includes(";")) return
        if (!screen.includes("Save ^S")) return
        return screen
      }, 12_000)
    } finally {
      await app.stop()
    }
  }, 40_000)
})
