import { test, expect } from "../fixtures"
import { modKey } from "../utils"

const expanded = async (el: { getAttribute: (name: string) => Promise<string | null> }) => {
  const value = await el.getAttribute("aria-expanded")
  if (value !== "true" && value !== "false") throw new Error(`Expected aria-expanded to be true|false, got: ${value}`)
  return value === "true"
}

test("review panel can be toggled via keybind", async ({ page, gotoSession }) => {
  await gotoSession()

  const treeToggle = page.getByRole("button", { name: "Toggle file tree" }).first()
  await expect(treeToggle).toBeVisible()
  if (await expanded(treeToggle)) await treeToggle.click()
  await expect(treeToggle).toHaveAttribute("aria-expanded", "false")

  const reviewToggle = page.getByRole("button", { name: "Toggle review" }).first()
  await expect(reviewToggle).toBeVisible()
  if (await expanded(reviewToggle)) await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("#review-panel")).toHaveCount(0)

  await page.keyboard.press(`${modKey}+Shift+R`)
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("#review-panel")).toBeVisible()

  await page.keyboard.press(`${modKey}+Shift+R`)
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("#review-panel")).toHaveCount(0)
})

test("side panel can collapse into a rail and expand again", async ({ page, gotoSession }) => {
  await gotoSession()

  const reviewToggle = page.getByRole("button", { name: "Toggle review" }).first()
  const treeToggle = page.getByRole("button", { name: "Toggle file tree" }).first()
  const side = page.locator("#review-panel")
  const tree = page.locator("#file-tree-panel")
  const collapse = page.locator('[data-action="session-side-panel-collapse"]')
  const expand = page.locator('[data-action="session-side-panel-expand"]')
  const allTab = tree.getByRole("tab", { name: /^all files$/i })

  await expect(reviewToggle).toBeVisible()
  if (await expanded(reviewToggle)) await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "false")

  await expect(treeToggle).toBeVisible()
  if (!(await expanded(treeToggle))) await treeToggle.click()
  await expect(treeToggle).toHaveAttribute("aria-expanded", "true")
  await expect(side).toBeVisible()
  await expect(tree).toBeVisible()

  await allTab.click()
  await expect(allTab).toHaveAttribute("aria-selected", "true")

  await collapse.click()
  await expect(side).toBeVisible()
  await expect(tree).toHaveCount(0)
  await expect(expand).toBeVisible()

  await expand.click()
  await expect(tree).toBeVisible()
  await expect(tree.getByRole("tab", { name: /^all files$/i })).toHaveAttribute("aria-selected", "true")

  await treeToggle.click()
  await expect(treeToggle).toHaveAttribute("aria-expanded", "false")
  await expect(side).toHaveCount(0)
})
