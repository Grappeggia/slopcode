import { describe, expect, test } from "bun:test"

const shell = await Bun.file(new URL("./ssh-shell.tsx", import.meta.url)).text()
const session = await Bun.file(new URL("./ssh-session.tsx", import.meta.url)).text()
const durable = await Bun.file(new URL("./ssh-durable-job.tsx", import.meta.url)).text()

describe("SSH shell accessibility regressions", () => {
  test("makes a closed drawer hidden and inert while the open modal hides the shell content", () => {
    expect(shell).toContain("aria-hidden={!open()}")
    expect(shell).toContain('aria-modal={open() ? "true" : undefined}')
    expect(shell).toContain("inert={!open()}")
    expect(shell).toContain('aria-hidden={open() ? "true" : undefined}')
    expect(shell).toContain("inert={open()}")
    expect(shell).toContain('data-ssh-shell-content aria-hidden={open()} inert={open()}')
    expect(shell).toContain("document.activeElement")
    expect(shell).toContain('event.key === "Escape"')
    expect(shell).toContain("items.at(-1)?.focus()")
    expect(shell).toContain("returnFocus?.focus()")
  })

  test("exposes mode tabs, prompt labeling, and active PTY session state", () => {
    expect(session).toContain('role="tablist"')
    expect(session).toContain('role="tab"')
    expect(session).toContain("aria-selected={mode() === \"prompt\"}")
    expect(session).toContain("aria-selected={mode() === \"interactive\"}")
    expect(session).toContain('aria-label="Prompt or interactive PTY input"')
    expect(session).toContain("sessionID={activeID()}")
    expect(session).toContain('return "Interactive PTY"')
    expect(shell).toContain("data-ssh-active-session={props.sessionID}")
  })

  test("keeps exact durable-job links on the shared Android Back path", () => {
    expect(durable).toContain("installAndroidBack")
    expect(durable).toContain("props.onContinue()")
  })
})
