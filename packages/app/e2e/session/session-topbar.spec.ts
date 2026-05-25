import { test, expect } from "../fixtures"
import { withSession } from "../actions"
import { sessionTitlebarSearchSelector, sessionTitleSelector } from "../selectors"

async function seedMessage(sdk: Parameters<typeof withSession>[0], sessionID: string) {
  await sdk.session.promptAsync({
    sessionID,
    noReply: true,
    parts: [{ type: "text", text: "e2e seed" }],
  })

  await expect
    .poll(
      async () => {
        const messages = await sdk.session.messages({ sessionID, limit: 1 }).then((r) => r.data ?? [])
        return messages.length
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0)
}

test("session top bars stay compact on desktop", async ({ page, sdk, gotoSession }) => {
  await page.setViewportSize({ width: 1400, height: 900 })

  const stamp = Date.now()

  await withSession(sdk, `e2e compact topbar ${stamp}`, async (session) => {
    await seedMessage(sdk, session.id)
    await gotoSession(session.id)

    const search = page.locator(sessionTitlebarSearchSelector).first()
    const title = page.locator(sessionTitleSelector).first()

    await expect(search).toBeVisible()
    await expect(title).toBeVisible()

    const searchBox = await search.boundingBox()
    const titleBox = await title.boundingBox()

    expect(searchBox).not.toBeNull()
    expect(titleBox).not.toBeNull()
    expect(searchBox!.width).toBeGreaterThan(300)
    expect(titleBox!.height).toBeLessThanOrEqual(50)
  })
})
