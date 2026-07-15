// Subprocess integration tests for `slopcode run` (non-interactive mode).
// These exercise the real CLI binary against a TestLLMServer running in the
// same process. See `test/lib/cli-process.ts` for the harness — each test uses
// `slopcode.run(message, opts?)` to spawn `bun src/index.ts run ...` with
// `SLOPCODE_CONFIG_CONTENT` providing the test provider config inline.
import { describe, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { Effect } from "effect"
import path from "node:path"
import { isRecord } from "@/util/record"
import { cliIt } from "../../lib/cli-process"
import { testProviderConfig } from "../../lib/test-provider"

function tools(input: Record<string, unknown> | undefined) {
  if (!Array.isArray(input?.tools)) return []
  return input.tools.flatMap((item) => {
    if (!item || typeof item !== "object" || !("function" in item)) return []
    const fn = item.function
    if (!fn || typeof fn !== "object" || !("name" in fn) || typeof fn.name !== "string") return []
    return [fn.name]
  })
}

describe("slopcode run (non-interactive subprocess)", () => {
  // Happy path: prompt completes, output reaches stdout, process exits 0.
  // If this fails, all the others likely will too — debug here first.
  cliIt.concurrent(
    "exits 0 and writes the response to stdout on a successful prompt",
    ({ llm, slopcode }) =>
      Effect.gen(function* () {
        yield* llm.text("hello from the test llm")
        const result = yield* slopcode.run("say hi")
        slopcode.expectExit(result, 0)
        expect(result.stdout).toContain("hello from the test llm")
      }),
    60_000,
  )

  cliIt.live(
    "denies plan_permissions when a local command resumes a plan session",
    ({ home, llm, slopcode }) =>
      Effect.gen(function* () {
        const env = {
          SLOPCODE_CONFIG_CONTENT: JSON.stringify({
            ...testProviderConfig(llm.url),
            command: {
              forecast: {
                template: "Continue planning without requesting build permissions.",
                agent: "plan",
              },
            },
          }),
          SLOPCODE_EXPERIMENTAL_PLAN_MODE: "true",
          SLOPCODE_DB: path.join(home, "run-process.db"),
        }
        yield* llm.text("seed complete")
        const seed = yield* slopcode.run("seed plan session", { agent: "plan", format: "json", env })
        slopcode.expectExit(seed, 0)
        const sessionID = slopcode.parseJsonEvents(seed.stdout)[0]?.sessionID
        if (typeof sessionID !== "string") throw new Error("failed to identify resumed plan session")
        const seedInput = (yield* llm.inputs).findLast((input) => JSON.stringify(input).includes("seed plan session"))
        expect(tools(seedInput)).not.toContain("plan_permissions")

        const ordinary = { permission: "bash", pattern: "git status", action: "ask" }
        const reset = () => {
          const db = new Database(env.SLOPCODE_DB)
          db.query("UPDATE session SET permission = ? WHERE id = ?").run(JSON.stringify([ordinary]), sessionID)
          const rows = db
            .query<
              { id: string; data: string },
              [string]
            >("SELECT id, data FROM event WHERE aggregate_id = ? AND type LIKE 'session.%'")
            .all(sessionID)
          let changed = 0
          rows.forEach((row) => {
            const data: unknown = JSON.parse(row.data)
            if (!isRecord(data) || !isRecord(data.info) || data.info.id !== sessionID) return
            data.info.permission = [ordinary]
            db.query("UPDATE event SET data = ? WHERE id = ?").run(JSON.stringify(data), row.id)
            changed += 1
          })
          db.close()
          return changed
        }
        const persisted = () => {
          const db = new Database(env.SLOPCODE_DB)
          const row = db
            .query<{ permission: string | null }, [string]>("SELECT permission FROM session WHERE id = ?")
            .get(sessionID)
          db.close()
          if (!row) throw new Error("session disappeared")
          const parsed: unknown = row.permission ? JSON.parse(row.permission) : []
          const rules = Array.isArray(parsed) ? parsed.filter(isRecord) : []
          return {
            counts: Object.fromEntries(
              ["question", "plan_enter", "plan_exit", "plan_permissions"].map((permission) => [
                permission,
                rules.filter(
                  (rule: { permission?: string; pattern?: string; action?: string }) =>
                    rule.permission === permission && rule.pattern === "*" && rule.action === "deny",
                ).length,
              ]),
            ),
            ordinary: rules.filter(
              (rule: { permission?: string; pattern?: string; action?: string }) =>
                rule.permission === ordinary.permission &&
                rule.pattern === ordinary.pattern &&
                rule.action === ordinary.action,
            ).length,
          }
        }
        expect(reset()).toBeGreaterThan(0)
        expect(persisted().ordinary).toBe(1)

        yield* llm.text("resume complete")
        const resumed = yield* slopcode.run("resume plan session", {
          agent: "plan",
          env,
          extraArgs: ["--session", sessionID],
          timeoutMs: 60_000,
        })
        slopcode.expectExit(resumed, 0)
        const resumedInput = (yield* llm.inputs).findLast((input) =>
          JSON.stringify(input).includes("resume plan session"),
        )
        expect(tools(resumedInput)).not.toContain("plan_permissions")
        yield* llm.text("resume again complete")
        slopcode.expectExit(
          yield* slopcode.run("resume plan session again", {
            agent: "plan",
            env,
            extraArgs: ["--session", sessionID],
            timeoutMs: 60_000,
          }),
          0,
        )
        expect(persisted()).toEqual({
          counts: { question: 1, plan_enter: 1, plan_exit: 1, plan_permissions: 1 },
          ordinary: 1,
        })
        expect(reset()).toBeGreaterThan(0)
        expect(persisted().ordinary).toBe(1)

        yield* llm.text("command complete")
        const result = yield* slopcode.run("", {
          agent: "plan",
          command: "forecast",
          env,
          extraArgs: ["--session", sessionID],
          timeoutMs: 60_000,
        })
        slopcode.expectExit(result, 0)

        const input = (yield* llm.inputs).at(-1)
        expect(tools(input).length).toBeGreaterThan(0)
        expect(tools(input)).not.toContain("plan_permissions")
        yield* llm.text("command again complete")
        slopcode.expectExit(
          yield* slopcode.run("", {
            agent: "plan",
            command: "forecast",
            env,
            extraArgs: ["--session", sessionID],
            timeoutMs: 60_000,
          }),
          0,
        )
        expect(persisted()).toEqual({
          counts: { question: 1, plan_enter: 1, plan_exit: 1, plan_permissions: 1 },
          ordinary: 1,
        })

        yield* llm.text("new command complete")
        const fresh = yield* slopcode.run("", {
          agent: "plan",
          command: "forecast",
          env,
          timeoutMs: 60_000,
        })
        slopcode.expectExit(fresh, 0)
        const freshInput = (yield* llm.inputs).at(-1)
        expect(tools(freshInput).length).toBeGreaterThan(0)
        expect(tools(freshInput)).not.toContain("plan_permissions")
      }),
    150_000,
  )

  // Regression for #27371: an unknown model used to hang the process forever
  // waiting on a session.status === idle event that never arrived. The fix
  // makes the SDK call surface an error promptly so the process exits nonzero.
  // We assert nonzero exit AND wall-clock under the harness timeout — a hang
  // would expire the timeout and produce a different (signal-killed) failure.
  cliIt.concurrent(
    "exits nonzero promptly when the model is unknown (regression for #27371)",
    ({ slopcode }) =>
      Effect.gen(function* () {
        const result = yield* slopcode.run("say hi", {
          model: "test/nonexistent-model",
          timeoutMs: 30_000,
        })
        expect(result.exitCode).not.toBe(0)
        expect(result.exitCode).not.toBe(-1)
        expect(result.durationMs).toBeLessThan(30_000)
      }),
    30_000,
  )

  // Locks in the current behavior: when the LLM stream errors mid-response
  // (the prompt was accepted, then the upstream provider failed), slopcode
  // emits a session.error event and the process exits 0 today.
  //
  // This is debatable — a future cleanup might flip it to exit 1. If you're
  // changing this expectation, do it deliberately and say so in the PR.
  cliIt.concurrent(
    "mid-stream LLM error still exits 0 today (contract lock-in)",
    ({ llm, slopcode }) =>
      Effect.gen(function* () {
        yield* llm.fail("upstream provider exploded mid-stream")
        const result = yield* slopcode.run("trigger midstream error", { timeoutMs: 30_000 })
        expect(result.exitCode).toBe(0)
      }),
    60_000,
  )

  // --format json puts one JSON object per line on stdout for each emitted
  // event. Consumers (CI scripts, tooling) parse this stream. Asserts the
  // shape so a future event-emit change has to update this expectation.
  cliIt.concurrent(
    "--format json emits parseable line-delimited JSON to stdout",
    ({ llm, slopcode }) =>
      Effect.gen(function* () {
        yield* llm.text("structured output")
        const result = yield* slopcode.run("say hi", { format: "json" })
        slopcode.expectExit(result, 0)

        const events = slopcode.parseJsonEvents(result.stdout)
        expect(events.length).toBeGreaterThan(0)
        for (const evt of events) {
          expect(typeof evt.type).toBe("string")
          expect(typeof evt.sessionID).toBe("string")
        }
        // At least one `text` event should appear with the LLM's response.
        const text = events.find((e) => e.type === "text")
        expect(text).toBeDefined()
      }),
    60_000,
  )
})
