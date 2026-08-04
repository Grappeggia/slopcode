import { expect, test } from "@playwright/test"

const url = "http://127.0.0.1:41743/ssh-agentic-session-dom-fixture.html"

for (const theme of ["light", "dark"] as const) {
  test(`${theme} agentic transcript and review remain visually stable`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("slopcode.android.ssh.color-scheme", value)
    }, theme)
    await page.goto(url)
    await expect(page.locator("body")).toHaveAttribute("data-fixture-complete", "true", { timeout: 15_000 })
    await expect(page.locator("body")).not.toHaveAttribute("data-fixture-error", /.+/)
    await page.evaluate(async () => await document.fonts.ready)

    const scroll = page.locator("[data-agent-scroll]")
    await scroll.evaluate((node) => node.scrollTo({ top: 0, behavior: "instant" }))
    await expect(page).toHaveScreenshot(`agentic-${theme}-transcript.png`)

    await scroll.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: "instant" }))
    await expect(page).toHaveScreenshot(`agentic-${theme}-review.png`)
  })
}
