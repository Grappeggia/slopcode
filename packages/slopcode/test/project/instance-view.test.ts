import { expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

test("Instance.state isolates state by view id", async () => {
  await using tmp = await tmpdir({ git: true })
  const value = Instance.state(() => ({ count: 0 }))

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      value().count = 1
      expect(value().count).toBe(1)
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-b",
    fn: async () => {
      expect(value().count).toBe(0)
      value().count = 2
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      expect(value().count).toBe(1)
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(value().count).toBe(0)
    },
  })
})

test("Instance.sharedState shares state across view id", async () => {
  await using tmp = await tmpdir({ git: true })
  const value = Instance.sharedState(() => ({ count: 0 }))

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      value().count = 1
      expect(value().count).toBe(1)
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-b",
    fn: async () => {
      expect(value().count).toBe(1)
      value().count = 2
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(value().count).toBe(2)
    },
  })
})
