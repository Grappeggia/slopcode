import { expect, test } from "@playwright/test"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import { mockSlopCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/SlopCode/NewSessionPromptAdmission"
const sessionID = "ses_prompt_admission"
const text = "keep this exact prompt"

test("queues new-session Enter and only promotes after durable admission", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  const prompts: Array<{ sessionID: string; messageID: string }> = []
  let creates = 0
  let releaseAgents!: () => void
  const agentsBlocked = new Promise<void>((resolve) => {
    releaseAgents = resolve
  })

  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_admission",
      worktree: directory,
      vcs: "git",
      name: "new-session-prompt-admission",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: {
            "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } },
          },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      agents: async () => {
        await agentsBlocked
        return [{ name: "build", mode: "primary" }]
      },
      sessionCreate: () => {
        creates++
        const session = {
          id: sessionID,
          slug: "prompt-admission",
          projectID: "proj_prompt_admission",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      promptAsync: async (request) => {
        const body = request.postDataJSON()
        if (!body || typeof body !== "object" || !("messageID" in body) || typeof body.messageID !== "string")
          throw new Error("prompt request is missing messageID")
        prompts.push({ sessionID: new URL(request.url()).pathname.split("/")[2] ?? "", messageID: body.messageID })
        if (prompts.length === 1) return { status: 400, body: { data: { message: "invalid prompt" } } }
        if (prompts.length === 2) return { status: 503, body: { data: { message: "unavailable" } } }
        return { status: 204 }
      },
    },
  })

  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  await expect(page).toHaveURL(/\/new-session\?draftId=/)
  const draftURL = page.url()
  const composer = page.locator('[data-component="session-new-composer"]')
  const input = composer.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill(text)
  await input.press("Enter")
  await input.press("Enter")

  await expect.poll(() => creates).toBe(0)
  const rejected = page.waitForResponse(
    (response) => response.url().includes("/prompt_async") && response.status() === 400,
  )
  releaseAgents()
  await rejected
  await expect.poll(() => prompts.length).toBe(1)
  await expect(page).toHaveURL(draftURL)
  await expect(input).toHaveText(text)
  await expect(page.getByText("invalid prompt")).toBeVisible()
  await page.evaluate(() => {
    history.pushState({}, "", "/")
    dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page).toHaveURL("/")
  await page.locator(`a[href="${new URL(draftURL).pathname + new URL(draftURL).search}"]`).click()
  await expect(input).toHaveText(text)

  const ambiguous = page.waitForResponse(
    (response) => response.url().includes("/prompt_async") && response.status() === 503,
  )
  await input.press("Enter")
  await ambiguous
  await expect.poll(() => prompts.length).toBe(2)
  await expect(page).toHaveURL(draftURL)
  await expect(input).toHaveText(text)
  await expect(page.getByText("unavailable")).toBeVisible()
  await page.evaluate(() => {
    history.pushState({}, "", "/")
    dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page).toHaveURL("/")
  await page.locator(`a[href="${new URL(draftURL).pathname + new URL(draftURL).search}"]`).click()
  await expect(input).toHaveText(text)

  await input.press("Enter")
  await expect.poll(() => prompts.length).toBe(3)
  await expect.poll(() => creates).toBe(1)
  expect(prompts[0]?.sessionID).toBe(sessionID)
  expect(prompts[1]?.sessionID).toBe(sessionID)
  expect(prompts[1]?.messageID).not.toBe(prompts[0]?.messageID)
  expect(prompts[2]?.sessionID).toBe(sessionID)
  expect(prompts[2]?.messageID).toBe(prompts[1]?.messageID)
  const sessionURL = `/${base64Encode(directory)}/session/${sessionID}`
  await expect(page).toHaveURL(sessionURL)
  await expect(page.locator(`a[href="${sessionURL}"]`)).toHaveCount(1)
  await expect(page.locator(`#message-${prompts[2]?.messageID}`)).toContainText(text)
})

test("transfers edits and mode changed during admission", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  let prompts = 0
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_transfer",
      worktree: directory,
      vcs: "git",
      name: "new-session-prompt-transfer",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      sessionCreate: () => {
        const session = {
          id: "ses_prompt_transfer",
          slug: "prompt-transfer",
          projectID: "proj_prompt_transfer",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      promptAsync: async () => {
        prompts++
        await blocked
        return { status: 204 }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  const input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("submitted prompt")
  await input.press("Enter")
  await expect.poll(() => prompts).toBe(1)
  await input.fill("edited while admission is pending")
  await input.press("Control+Shift+X")
  await expect(input).toHaveClass(/font-mono/)
  const draftURL = page.url()
  await page.locator('a[href="/"]').first().click()
  const accepted = page.waitForResponse((response) => response.url().includes("/prompt_async"))
  release()
  await accepted
  await expect(page).toHaveURL("/")
  await page.locator(`a[href="${new URL(draftURL).pathname + new URL(draftURL).search}"]`).click()

  await expect(page).toHaveURL(`/${base64Encode(directory)}/session/ses_prompt_transfer`)
  expect(prompts).toBe(1)
  const next = page.locator('[data-component="prompt-input"]')
  await expect(next).toHaveText("edited while admission is pending")
  await expect(next).toHaveClass(/font-mono/)
})

test("cancels a queued Enter when the draft composer unmounts", async ({ page }) => {
  let releaseAgents!: () => void
  const blocked = new Promise<void>((resolve) => {
    releaseAgents = resolve
  })
  let creates = 0
  let prompts = 0
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_queue_cleanup",
      worktree: directory,
      vcs: "git",
      name: "prompt-queue-cleanup",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions: [],
    pageMessages: () => ({ items: [] }),
    handlers: {
      agents: async () => {
        await blocked
        return [{ name: "build", mode: "primary" }]
      },
      sessionCreate: () => {
        creates++
        return { id: "ses_queue_cleanup" }
      },
      promptAsync: () => {
        prompts++
        return { status: 204 }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  const input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("queued prompt")
  await input.press("Enter")
  await page.locator('a[href="/"]').first().click()
  const agents = page.waitForResponse((response) => response.url().includes("/agent"))
  releaseAgents()
  await agents
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
  expect(creates).toBe(0)
  expect(prompts).toBe(0)
})

test("submits through the direct no-draft route", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_direct",
      worktree: directory,
      vcs: "git",
      name: "prompt-direct",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      sessionCreate: () => {
        const session = {
          id: "ses_prompt_direct",
          slug: "prompt-direct",
          projectID: "proj_prompt_direct",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      promptAsync: () => ({ status: 204 }),
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: false } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  const input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("direct prompt")
  await input.press("Enter")
  await expect(page).toHaveURL(`/${base64Encode(directory)}/session/ses_prompt_direct`)
})

test("cannot promote a draft closed during admission", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  let prompts = 0
  let deleted = 0
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_close",
      worktree: directory,
      vcs: "git",
      name: "prompt-close",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      sessionCreate: () => {
        const session = {
          id: "ses_prompt_close",
          slug: "prompt-close",
          projectID: "proj_prompt_close",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      sessionDelete: () => {
        deleted++
        return { deleted: true }
      },
      promptAsync: async () => {
        prompts++
        await blocked
        return { status: 204 }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  const input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("close while sending")
  await input.press("Enter")
  await expect.poll(() => prompts).toBe(1)
  await page.getByRole("button", { name: "Close tab" }).click()
  await expect(page).toHaveURL("/")
  const response = page.waitForResponse((item) => item.url().includes("/prompt_async"))
  release()
  await response

  await expect.poll(() => deleted).toBe(1)
  await expect(page).toHaveURL("/")
  await expect(page.locator(`a[href="/${base64Encode(directory)}/session/ses_prompt_close"]`)).toHaveCount(0)
})

test("abandons an ambiguous direct-route admission without stale reuse", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  const ids: string[] = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  let creates = 0
  let prompts = 0
  let deleted = 0
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_abandon",
      worktree: directory,
      vcs: "git",
      name: "prompt-abandon",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      sessionCreate: () => {
        creates++
        const session = {
          id: `ses_prompt_abandon_${creates}`,
          slug: `prompt-abandon-${creates}`,
          projectID: "proj_prompt_abandon",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      sessionDelete: () => {
        deleted++
        return { deleted: true }
      },
      promptAsync: async (request) => {
        prompts++
        const body = request.postDataJSON()
        if (body && typeof body === "object" && "messageID" in body && typeof body.messageID === "string")
          ids.push(body.messageID)
        if (prompts === 1) {
          await blocked
          return { status: 503, body: { data: { message: "unavailable" } } }
        }
        return { status: 204 }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: false } }))
  })

  const route = `/${base64Encode(directory)}/session`
  await page.goto(route)
  let input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("direct abandoned prompt")
  await input.press("Enter")
  await expect.poll(() => prompts).toBe(1)
  await page.evaluate(() => {
    history.pushState({}, "", "/")
    dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page).toHaveURL("/")
  const response = page.waitForResponse((item) => item.url().includes("/prompt_async"))
  release()
  await response
  await expect.poll(() => deleted).toBe(1)

  await page.evaluate((route) => {
    history.pushState({}, "", route)
    dispatchEvent(new PopStateEvent("popstate"))
  }, route)
  input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.press("Enter")
  await expect(page).toHaveURL(`/${base64Encode(directory)}/session/ses_prompt_abandon_2`)
  expect(creates).toBe(2)
  expect(ids).toHaveLength(2)
  expect(ids[1]).not.toBe(ids[0])
})

for (const status of [400, 503]) {
  test(`deletes a settled ${status} provisional when closing its draft`, async ({ page }) => {
    const sessions: Array<Record<string, unknown> & { id: string }> = []
    let deleted = 0
    await mockSlopCodeServer(page, {
      directory,
      project: {
        id: `proj_prompt_close_${status}`,
        worktree: directory,
        vcs: "git",
        name: `prompt-close-${status}`,
        time: { created: 1700000000000, updated: 1700000000000 },
        sandboxes: [],
      },
      provider: {
        all: [
          {
            id: "slopcode",
            name: "SlopCode",
            models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
          },
        ],
        connected: ["slopcode"],
        default: { slopcode: "test-model" },
      },
      sessions,
      pageMessages: () => ({ items: [] }),
      handlers: {
        sessionCreate: () => {
          const session = {
            id: `ses_prompt_close_${status}`,
            slug: `prompt-close-${status}`,
            projectID: `proj_prompt_close_${status}`,
            directory,
            title: "New session",
            version: "dev",
            time: { created: 1700000000000, updated: 1700000000000 },
          }
          sessions.push(session)
          return session
        },
        sessionDelete: () => {
          deleted++
          return { deleted: true }
        },
        promptAsync: () => ({ status, body: { data: { message: "admission failed" } } }),
      },
    })
    await page.addInitScript(() => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    })

    await page.goto(`/${base64Encode(directory)}/session`)
    const input = page.locator('[data-component="prompt-input"]')
    await expectAppVisible(input)
    const response = page.waitForResponse((item) => item.url().includes("/prompt_async") && item.status() === status)
    await input.fill(`close settled ${status}`)
    await input.press("Enter")
    await response
    await expect(page.getByText("admission failed")).toBeVisible()
    await page.getByRole("button", { name: "Close tab" }).click()

    await expect.poll(() => deleted).toBe(1)
    await expect(page).toHaveURL("/")
    await expect(page.locator(`a[href="/${base64Encode(directory)}/session/ses_prompt_close_${status}"]`)).toHaveCount(
      0,
    )
  })
}

test("deletes a session returned after its draft closed during create", async ({ page }) => {
  const sessions: Array<Record<string, unknown> & { id: string }> = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  let creates = 0
  let deleted = 0
  await mockSlopCodeServer(page, {
    directory,
    project: {
      id: "proj_prompt_close_create",
      worktree: directory,
      vcs: "git",
      name: "prompt-close-create",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "slopcode",
          name: "SlopCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["slopcode"],
      default: { slopcode: "test-model" },
    },
    sessions,
    pageMessages: () => ({ items: [] }),
    handlers: {
      sessionCreate: async () => {
        creates++
        await blocked
        const session = {
          id: "ses_prompt_close_create",
          slug: "prompt-close-create",
          projectID: "proj_prompt_close_create",
          directory,
          title: "New session",
          version: "dev",
          time: { created: 1700000000000, updated: 1700000000000 },
        }
        sessions.push(session)
        return session
      },
      sessionDelete: () => {
        deleted++
        return { deleted: true }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session`)
  const input = page.locator('[data-component="prompt-input"]')
  await expectAppVisible(input)
  await input.fill("close during create")
  await input.press("Enter")
  await expect.poll(() => creates).toBe(1)
  await page.getByRole("button", { name: "Close tab" }).click()
  await expect(page).toHaveURL("/")
  release()

  await expect.poll(() => deleted).toBe(1)
  await expect(page.locator(`a[href="/${base64Encode(directory)}/session/ses_prompt_close_create"]`)).toHaveCount(0)
})
