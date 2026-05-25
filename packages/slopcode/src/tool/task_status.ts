import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./task_status.txt"
import { BackgroundJob } from "@/background/job"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionStatus } from "@/session/status"
import { Flag } from "@/flag/flag"

const DEFAULT_TIMEOUT = 60_000
const POLL_MS = 300

const parameters = z.object({
  task_id: z.string().describe("The task_id returned by the task tool"),
  wait: z.boolean().describe("When true, wait until the task reaches a terminal state or timeout").optional(),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .describe("Maximum milliseconds to wait when wait=true (default: 60000)")
    .optional(),
})

type State = BackgroundJob.Status

type InspectResult = {
  state: State
  text: string
}

function format(input: { taskID: string; state: State; text: string }) {
  const tag = input.state === "completed" || input.state === "running" ? "task_result" : "task_error"
  return [`task_id: ${input.taskID}`, `state: ${input.state}`, "", `<${tag}>`, input.text, `</${tag}>`].join("\n")
}

function errorText(error: NonNullable<MessageV2.Assistant["error"]>) {
  const data = Reflect.get(error, "data")
  const message = data && typeof data === "object" ? Reflect.get(data, "message") : undefined
  if (typeof message === "string" && message) return message
  return error.name
}

function inspectMessage(message: MessageV2.WithParts): InspectResult | undefined {
  if (message.info.role !== "assistant") return
  const text = message.parts.findLast((part) => part.type === "text")?.text ?? ""
  if (message.info.error) return { state: "error", text: text || errorText(message.info.error) }
  if (message.info.finish && !["tool-calls", "unknown"].includes(message.info.finish)) {
    return { state: "completed", text }
  }
  return { state: "running", text: text || "Task is still running." }
}

async function inspect(taskID: string): Promise<InspectResult> {
  const job = BackgroundJob.get(taskID)
  if (job) {
    return {
      state: job.status,
      text:
        job.output ??
        job.error ??
        (job.status === "running" ? "Task is still running." : job.status === "cancelled" ? "Task was cancelled." : ""),
    }
  }

  const current = SessionStatus.get(taskID)
  if (current.type === "busy" || current.type === "retry") {
    return {
      state: "running",
      text: current.type === "retry" ? `Task is retrying: ${current.message}` : "Task is still running.",
    }
  }

  const messages = await Session.messages({ sessionID: taskID, limit: 20 }).catch(() => [])
  const latest = messages.find((message) => message.info.role === "assistant")
  if (latest) {
    const result = inspectMessage(latest)
    if (!result) return { state: "error", text: "Task is not running in this process." }
    if (result.state === "running") {
      return { state: "error", text: "Task is not running in this process and has no final output." }
    }
    return result
  }
  return { state: "error", text: "Task is not running in this process and has not produced output." }
}

async function waitForTerminal(taskID: string, timeout: number): Promise<{ result: InspectResult; timedOut: boolean }> {
  const result = await inspect(taskID)
  if (result.state !== "running") return { result, timedOut: false }
  if (timeout <= 0) return { result, timedOut: true }
  const sleep = Math.min(POLL_MS, timeout)
  await new Promise((resolve) => setTimeout(resolve, sleep))
  return waitForTerminal(taskID, timeout - sleep)
}

export const TaskStatusTool = Tool.define("task_status", {
  description: DESCRIPTION,
  parameters,
  async execute(params) {
    if (!Flag.SLOPCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS) {
      throw new Error("task_status requires SLOPCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true")
    }

    const session = await Session.get(params.task_id).catch(() => undefined)
    if (!session) {
      return {
        title: "Task status",
        metadata: {
          task_id: params.task_id,
          state: "error" as const,
          timed_out: false,
        },
        output: format({ taskID: params.task_id, state: "error", text: `Task not found: ${params.task_id}` }),
      }
    }

    const waited =
      params.wait === true
        ? await BackgroundJob.wait({ id: params.task_id, timeout: params.timeout_ms ?? DEFAULT_TIMEOUT })
        : { info: BackgroundJob.get(params.task_id), timedOut: false }
    const result = waited.info
      ? {
          result: {
            state: waited.info.status,
            text:
              waited.info.output ??
              waited.info.error ??
              (waited.info.status === "running" ? "Task is still running." : ""),
          },
          timedOut: waited.timedOut,
        }
      : params.wait === true
        ? await waitForTerminal(params.task_id, params.timeout_ms ?? DEFAULT_TIMEOUT)
        : { result: await inspect(params.task_id), timedOut: false }

    const text = result.timedOut
      ? `Timed out after ${params.timeout_ms ?? DEFAULT_TIMEOUT}ms while waiting for task completion.`
      : result.result.text

    return {
      title: "Task status",
      metadata: {
        task_id: params.task_id,
        state: result.result.state,
        timed_out: result.timedOut,
      },
      output: format({ taskID: params.task_id, state: result.result.state, text }),
    }
  },
})
