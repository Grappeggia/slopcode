import { test, expect } from "../fixtures"
import type { Page } from "@playwright/test"
import { promptSelector, sessionItemSelector } from "../selectors"
import { openSidebar, sessionIDFromUrl, withSession } from "../actions"

function contextButton(page: Page) {
  return page
    .locator('[data-component="button"]')
    .filter({ has: page.locator('[data-component="progress-circle"]').first() })
    .first()
}

async function seedContextSession(input: { sessionID: string; sdk: Parameters<typeof withSession>[0] }) {
  await input.sdk.session.promptAsync({
    sessionID: input.sessionID,
    noReply: true,
    parts: [
      {
        type: "text",
        text: "seed context",
      },
    ],
  })

  await expect
    .poll(async () => {
      const messages = await input.sdk.session
        .messages({ sessionID: input.sessionID, limit: 1 })
        .then((r) => r.data ?? [])
      return messages.length
    })
    .toBeGreaterThan(0)
}

async function openFileTab(page: Page, name: string) {
  await page.locator(promptSelector).click()
  await page.keyboard.type("/open")
  await expect(page.locator('[data-slash-id="file.open"]').first()).toBeVisible()
  await page.keyboard.press("Enter")

  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByPlaceholder(/search files/i) })
    .first()
  await expect(dialog).toBeVisible()

  await dialog.getByRole("textbox").first().fill(name)
  const item = dialog.locator('[data-slot="list-item"][data-key^="file:"]').first()
  await expect(item).toBeVisible({ timeout: 30_000 })
  await item.click()
  await expect(dialog).toHaveCount(0)
}

test("context panel can be opened from the prompt", async ({ page, sdk, gotoSession }) => {
  const title = `e2e smoke context ${Date.now()}`

  await withSession(sdk, title, async (session) => {
    await seedContextSession({ sessionID: session.id, sdk })

    await gotoSession(session.id)

    const trigger = contextButton(page)
    await expect(trigger).toBeVisible()
    await trigger.click()

    const tabs = page.locator('[data-component="tabs"][data-variant="normal"]')
    await expect(tabs.getByRole("tab", { name: "Context" })).toBeVisible()
  })
})

test("context panel can be closed from the context tab close action", async ({ page, sdk, gotoSession }) => {
  await withSession(sdk, `e2e context toggle ${Date.now()}`, async (session) => {
    await seedContextSession({ sessionID: session.id, sdk })
    await gotoSession(session.id)

    await page.locator(promptSelector).click()

    const trigger = contextButton(page)
    await expect(trigger).toBeVisible()
    await trigger.click()

    const tabs = page.locator('[data-component="tabs"][data-variant="normal"]')
    const context = tabs.getByRole("tab", { name: "Context" })
    await expect(context).toBeVisible()

    await page.getByRole("button", { name: "Close tab" }).first().click()
    await expect(context).toHaveCount(0)
  })
})

test("context panel can open file picker from context actions", async ({ page, sdk, gotoSession }) => {
  await withSession(sdk, `e2e context tabs ${Date.now()}`, async (session) => {
    await seedContextSession({ sessionID: session.id, sdk })
    await gotoSession(session.id)

    await page.locator(promptSelector).click()

    const trigger = contextButton(page)
    await expect(trigger).toBeVisible()
    await trigger.click()

    await expect(page.getByRole("tab", { name: "Context" })).toBeVisible()
    await page.getByRole("button", { name: "Open file" }).first().click()

    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByPlaceholder(/search files/i) })
      .first()
    await expect(dialog).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
  })
})

test("slash fork keeps file and context tabs and shows the fork in the sidebar", async ({ page, sdk, gotoSession }) => {
  await withSession(sdk, `e2e fork tabs ${Date.now()}`, async (session) => {
    await seedContextSession({ sessionID: session.id, sdk })
    await gotoSession(session.id)

    await openFileTab(page, "package.json")

    await page.locator(promptSelector).click()
    const trigger = contextButton(page)
    await expect(trigger).toBeVisible()
    await trigger.click()

    const tabs = page.locator('[data-component="tabs"][data-variant="normal"]')
    await expect(tabs.getByRole("tab", { name: "Context" })).toBeVisible()
    await expect(tabs.getByRole("tab", { name: "package.json" })).toBeVisible()

    await page.locator(promptSelector).click()
    await page.keyboard.type("/fork")
    await expect(page.locator('[data-slash-id="session.fork"]').first()).toBeVisible()
    await page.keyboard.press("Enter")

    const dialog = page.getByRole("dialog").filter({ hasText: "Fork from message" }).first()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-slot="list-item"]').first()).toBeVisible()
    await dialog.locator('[data-slot="list-item"]').first().click()
    await expect(dialog).toHaveCount(0)

    await expect
      .poll(() => {
        const id = sessionIDFromUrl(page.url())
        return id && id !== session.id ? id : ""
      })
      .not.toBe("")

    const forkedID = sessionIDFromUrl(page.url())
    if (!forkedID || forkedID === session.id) throw new Error("Forked session was not created")

    await openSidebar(page)
    await expect(page.locator(sessionItemSelector(forkedID)).first()).toBeVisible()
    await expect(tabs.getByRole("tab", { name: "Context" })).toBeVisible()
    await expect(tabs.getByRole("tab", { name: "package.json" })).toBeVisible()
  })
})
