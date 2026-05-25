import http from "node:http"
import type { AddressInfo } from "node:net"
import { test, expect } from "../fixtures"
import { cleanupTestProject, createTestProject, seedProjects } from "../actions"
import { promptSelector } from "../selectors"
import { createSdk, sessionPath } from "../utils"

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return ""
      if (!("type" in item)) return ""
      if (item.type !== "text") return ""
      return "text" in item && typeof item.text === "string" ? item.text : ""
    })
    .join("\n")
}

function stream(chunks: unknown[]) {
  return [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`), "data: [DONE]"].join("\n\n")
}

async function mockProvider(input: { firstToken: string; secondToken: string }) {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/chat/completions") {
      res.writeHead(404)
      res.end()
      return
    }

    const body = await new Promise<string>((resolve, reject) => {
      let text = ""
      req.setEncoding("utf8")
      req.on("data", (chunk) => {
        text += chunk
      })
      req.on("end", () => resolve(text))
      req.on("error", reject)
    })
    const json = JSON.parse(body) as { messages?: Array<{ role?: string; content?: unknown }> }
    const messages = json.messages ?? []
    const lastUser = [...messages].reverse().find((item) => item.role === "user")
    const userText = textOf(lastUser?.content)
    const hasTool = messages.some((item) => item.role === "tool")

    const reply = (() => {
      if (userText.includes(input.secondToken)) {
        return stream([
          {
            id: "chatcmpl-second",
            object: "chat.completion.chunk",
            created: 1,
            model: "mock-tool",
            choices: [{ index: 0, delta: { role: "assistant", content: input.secondToken }, finish_reason: "stop" }],
          },
        ])
      }

      if (hasTool) {
        return stream([
          {
            id: "chatcmpl-first-finish",
            object: "chat.completion.chunk",
            created: 1,
            model: "mock-tool",
            choices: [{ index: 0, delta: { role: "assistant", content: input.firstToken }, finish_reason: "stop" }],
          },
        ])
      }

      return stream([
        {
          id: "chatcmpl-first-tool",
          object: "chat.completion.chunk",
          created: 1,
          model: "mock-tool",
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: "call_serial_test",
                    type: "function",
                    function: {
                      name: "bash",
                      arguments: JSON.stringify({
                        command: `sleep 3 && printf ${input.firstToken}`,
                        description: "Hold serial queue test open",
                        workdir: "/",
                      }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
      ])
    })()

    if (hasTool) {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }

    res.writeHead(200, { "Content-Type": "text/event-stream" })
    res.end(reply)
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve())
    server.on("error", reject)
  })

  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Failed to bind mock provider")

  return {
    baseURL: `http://127.0.0.1:${(address as AddressInfo).port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

async function assistantText(sdk: ReturnType<typeof createSdk>, sessionID: string) {
  const messages = await sdk.session.messages({ sessionID, limit: 100 }).then((r) => r.data ?? [])
  return messages
    .filter((m) => m.info.role === "assistant")
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

test("serial queue delays second prompt_async request until first turn completes", async ({ page }) => {
  test.setTimeout(120_000)

  const directory = await createTestProject()
  const sdk = createSdk(directory)
  const firstToken = `SERIAL_FIRST_${Date.now()}`
  const secondToken = `SERIAL_SECOND_${Date.now()}`
  const providerID = "mockserial"
  const modelID = "mock-tool"
  const provider = await mockProvider({ firstToken, secondToken })
  const requests: Array<{ body: unknown; at: number }> = []

  await seedProjects(page, { directory })
  await page.addInitScript(
    (model) => {
      localStorage.setItem("slopcode.global.dat:model", JSON.stringify({ recent: [model], user: [], variant: {} }))
    },
    { providerID, modelID },
  )

  try {
    await sdk.global.config.update({
      config: {
        queue_mode: "serial",
        provider: {
          [providerID]: {
            npm: "@ai-sdk/openai-compatible",
            name: "Mock Serial",
            options: {
              baseURL: provider.baseURL,
            },
            models: {
              [modelID]: {
                name: "Mock Tool",
              },
            },
          },
        },
      },
    })
    await expect.poll(async () => await sdk.config.get().then((r) => r.data?.queue_mode)).toBe("serial")
    await expect
      .poll(async () => {
        const data = await sdk.provider.list().then((r) => r.data)
        return data?.connected.includes(providerID)
      })
      .toBe(true)

    const session = await sdk.session
      .create({
        title: `e2e serial queue ${Date.now()}`,
        permission: [{ permission: "bash", action: "allow", pattern: "*" }],
      })
      .then((r) => r.data)
    if (!session?.id) throw new Error("Session create did not return an id")

    await page.route("**/session/*/prompt_async", async (route) => {
      requests.push({ body: route.request().postDataJSON(), at: Date.now() })
      await route.continue()
    })

    try {
      await page.goto(sessionPath(directory, session.id))
      await expect(page.locator(promptSelector)).toBeVisible()
      await page.evaluate(
        (model) => {
          localStorage.setItem("slopcode.global.dat:model", JSON.stringify({ recent: [model], user: [], variant: {} }))
        },
        { providerID, modelID },
      )
      await page.reload()
      await expect(page.locator(promptSelector)).toBeVisible()
      await expect(page.getByText("Mock Tool")).toBeVisible()

      const prompt = page.locator(promptSelector)
      await prompt.fill("Start the serial queue test")
      await expect(prompt).toContainText("Start the serial queue test")
      await page.getByRole("button", { name: "Send" }).click()

      await expect.poll(() => requests.length, { timeout: 30_000 }).toBe(1)

      await prompt.fill(`Reply with exactly ${secondToken}`)
      await expect(prompt).toContainText(secondToken)
      await page.getByRole("button", { name: "Send" }).click()

      await page.waitForTimeout(4_500)
      expect(requests).toHaveLength(1)
      await expect.poll(async () => await assistantText(sdk, session.id), { timeout: 90_000 }).toContain(firstToken)

      await expect.poll(() => requests.length, { timeout: 30_000 }).toBe(2)
      await expect.poll(async () => await assistantText(sdk, session.id), { timeout: 90_000 }).toContain(secondToken)
      expect(JSON.stringify(requests[1]?.body ?? {})).toContain(secondToken)
    } finally {
      await page.unroute("**/session/*/prompt_async")
      await sdk.session.delete({ sessionID: session.id }).catch(() => undefined)
    }
  } finally {
    await provider.close().catch(() => undefined)
    await cleanupTestProject(directory)
  }
})
