import { expect, test } from "bun:test"
import stripAnsi from "strip-ansi"
import { logo } from "../../src/logo"
import { sessionEpilogue } from "../../src/util/presentation"

function plain(row: string) {
  return row.replaceAll("_", " ").replaceAll("^", "▀").replaceAll("~", "▀").replaceAll(",", " ")
}

test("formats session continuation summary", () => {
  const epilogue = sessionEpilogue({ title: "A session", sessionID: "ses_123" })
  expect(epilogue).toContain("A session")
  expect(epilogue).toContain("slopcode -s ses_123")
  const clean = stripAnsi(epilogue)
  for (const row of logo.left.map((item, index) => `${plain(item)} ${plain(logo.right[index] ?? "")}`)) {
    expect(clean).toContain(row)
  }
})
