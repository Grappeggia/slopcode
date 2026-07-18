import { expect, test } from "bun:test"

test("proxies Zen routes to the upstream gateway", async () => {
  const config = await Bun.file(new URL("../vercel.json", import.meta.url)).json()

  expect(config.rewrites).toEqual([
    {
      source: "/zen/:path*",
      destination: "https://opencode.ai/zen/:path*",
    },
  ])
})
