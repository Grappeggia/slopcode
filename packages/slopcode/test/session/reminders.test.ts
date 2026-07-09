import { expect } from "bun:test"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Memory } from "../../src/memory/memory"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { Session } from "../../src/session/session"
import { SessionReminders } from "../../src/session/reminders"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(Session.defaultLayer, FSUtil.defaultLayer, RuntimeFlags.layer({})))
const memoryIt = testEffect(
  Layer.mergeAll(
    Session.defaultLayer,
    FSUtil.defaultLayer,
    RuntimeFlags.layer({}),
    Layer.mock(Memory.Service, {
      select: () =>
        Effect.succeed([
          {
            id: Memory.ID.create(),
            scope: "project" as const,
            content: "Prefer small focused changes in this project",
            enabled: true,
            time: { created: 1, updated: 1 },
          },
        ]),
    }),
  ),
)

const model = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test"),
}

const build = {
  name: "build",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent.Info

const plan = {
  name: "plan",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent.Info

const goal = {
  name: "goal",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent.Info

function user(sessionID: SessionID, text: string) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    const msg = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      sessionID,
      role: "user",
      agent: "build",
      model,
      time: { created: Date.now() },
    })
    yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID,
      messageID: msg.id,
      type: "text",
      text,
    })
    return msg
  })
}

function texts(messages: SessionV1.WithParts[]) {
  return messages.flatMap((msg) => msg.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])))
}

it.instance("injects active goals into build turns", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({ metadata: { goal: { text: "Finish validation", status: "active" } } })
    yield* user(session.id, "next")
    const messages = yield* sessions.messages({ sessionID: session.id })

    const all = texts(yield* SessionReminders.apply({ messages, agent: build, session }))

    expect(all).toContain(
      "<system-reminder>\nCurrent session goal: Finish validation\nUse this as the north star unless the user explicitly changes it.\n</system-reminder>",
    )
  }),
)

it.instance("injects active goals before plan-mode reminders", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({ metadata: { goal: { text: "Plan the release", status: "active" } } })
    yield* user(session.id, "plan")
    const messages = yield* sessions.messages({ sessionID: session.id })

    const all = texts(yield* SessionReminders.apply({ messages, agent: plan, session }))

    expect(all.some((text) => text.includes("Current session goal: Plan the release"))).toBe(true)
    expect(all.some((text) => text.includes("Plan Mode - System Reminder"))).toBe(true)
  }),
)

it.instance("does not inject missing, paused, or malformed goals", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const inputs = [undefined, { goal: { text: "Paused", status: "paused" } }, { goal: { text: "" } }]

    for (const metadata of inputs) {
      const session = yield* sessions.create({ metadata })
      yield* user(session.id, "next")
      const messages = yield* sessions.messages({ sessionID: session.id })

      const all = texts(yield* SessionReminders.apply({ messages, agent: build, session }))

      expect(all.some((text) => text.includes("Current session goal:"))).toBe(false)
    }
  }),
)

it.instance("shows Goal mode prompt with current goal status", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({ metadata: { goal: { text: "Keep scope tight", status: "paused" } } })
    yield* user(session.id, "status")
    const messages = yield* sessions.messages({ sessionID: session.id })

    const all = texts(yield* SessionReminders.apply({ messages, agent: goal, session }))

    expect(all.some((text) => text.includes("Goal mode is active"))).toBe(true)
    expect(all.some((text) => text.includes("Paused: Keep scope tight"))).toBe(true)
    expect(all.some((text) => text.includes("Current session goal:"))).toBe(false)
  }),
)

memoryIt.instance("injects memories without persisting them", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    yield* user(session.id, "next")
    const messages = yield* sessions.messages({ sessionID: session.id })

    const all = texts(yield* SessionReminders.apply({ messages, agent: build, session }))
    const stored = texts(yield* sessions.messages({ sessionID: session.id }))

    expect(all.some((text) => text.includes("Relevant memories for this session"))).toBe(true)
    expect(all.some((text) => text.includes("Prefer small focused changes in this project"))).toBe(true)
    expect(stored.some((text) => text.includes("Relevant memories for this session"))).toBe(false)
  }),
)
