import { Hono, type Context } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Bus } from "../../bus"
import { Session } from "../../session"
import { MessageV2 } from "@/session/message-v2"
import { SessionStatus } from "@/session/status"
import { File } from "@/file"
import { LSP } from "@/lsp"
import { MCP } from "@/mcp"
import { PermissionNext } from "@/permission/next"
import { TuiEvent } from "@/cli/cmd/tui/event"
import {
  createSurfaceManifest,
  createSurfaceSnapshot,
  TuiSurfaceAction,
  TuiSurfaceManifest,
  TuiSurfaceSnapshot,
} from "@/cli/cmd/tui/surface"
import { TuiConfig } from "@/config/tui"
import { AsyncQueue } from "../../util/queue"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { Instance } from "@/project/instance"

const TuiRequest = z.object({
  path: z.string(),
  body: z.any(),
})

type TuiRequest = z.infer<typeof TuiRequest>

const requests = new Map<string, AsyncQueue<TuiRequest>>()
const responses = new Map<string, AsyncQueue<unknown>>()

function queueKey() {
  return Instance.viewID ?? "shared"
}

function requestQueue() {
  const key = queueKey()
  const existing = requests.get(key)
  if (existing) return existing
  const next = new AsyncQueue<TuiRequest>()
  requests.set(key, next)
  return next
}

function responseQueue() {
  const key = queueKey()
  const existing = responses.get(key)
  if (existing) return existing
  const next = new AsyncQueue<unknown>()
  responses.set(key, next)
  return next
}

function scoped<T extends Record<string, unknown>>(properties: T): T {
  if (!Instance.viewID) return properties
  return {
    ...properties,
    viewID: Instance.viewID,
  }
}

export async function callTui(ctx: Context) {
  const body = await ctx.req.json()
  requestQueue().push({
    path: ctx.req.path,
    body,
  })
  return responseQueue().next()
}

const commandMap: Record<string, string> = {
  "help.show": "help.show",
  "session.new": "session.new",
  "session.list": "session.list",
  "session.status": "slopcode.status",
  "session.share": "session.share",
  "session.compact": "session.compact",
  "session.interrupt": "session.interrupt",
  "model.list": "model.list",
  "provider.list": "provider.connect",
  "agent.list": "agent.list",
  "sidebar.summary": "session.sidebar.toggle",
  "sidebar.files": "session.files.open",
  "theme.list": "theme.switch",
  "plugins.list": "plugins.list",
}

async function snapshot(sessionID?: string) {
  const sessions: Session.Info[] = []
  for await (const session of Session.list({ roots: true, limit: 8 })) {
    sessions.push(session)
  }
  const active = sessionID
    ? await Session.get(sessionID).catch(() => undefined)
    : sessions[0]
  const messages = active
    ? await MessageV2.index({ sessionID: active.id, limit: 40 }).catch(() => [])
    : []
  const chunks =
    active && messages.length
      ? await MessageV2.chunk({
          sessionID: active.id,
          messageIDs: messages.map((item) => item.id),
        }).catch(() => [])
      : []
  const [files, lsp, mcp, permissions] = await Promise.all([
    File.status().catch(() => []),
    LSP.status().catch(() => []),
    MCP.status().catch(() => ({})),
    PermissionNext.list(active ? { sessionID: active.id } : {}).catch(() => []),
  ])
  return createSurfaceSnapshot({
    directory: Instance.directory,
    session: active,
    sessions,
    status: SessionStatus.list(),
    messages,
    chunks,
    files,
    lsp,
    mcp,
    permissions: permissions.length,
  })
}

const TuiControlRoutes = new Hono()
  .get(
    "/next",
    describeRoute({
      summary: "Get next TUI request",
      description: "Retrieve the next TUI (Terminal User Interface) request from the queue for processing.",
      operationId: "tui.control.next",
      responses: {
        200: {
          description: "Next TUI request",
          content: {
            "application/json": {
              schema: resolver(TuiRequest),
            },
          },
        },
      },
    }),
    async (c) => {
      const req = await requestQueue().next()
      return c.json(req)
    },
  )
  .post(
    "/response",
    describeRoute({
      summary: "Submit TUI response",
      description: "Submit a response to the TUI request queue to complete a pending request.",
      operationId: "tui.control.response",
      responses: {
        200: {
          description: "Response submitted successfully",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
      },
    }),
    validator("json", z.any()),
    async (c) => {
      const body = c.req.valid("json")
      responseQueue().push(body)
      return c.json(true)
    },
  )

export const TuiRoutes = lazy(() =>
  new Hono()
    .get(
      "/manifest",
      describeRoute({
        summary: "Get shared TUI manifest",
        description: "Return the shared command, keybind, and capability manifest used by Linux and Android TUI renderers.",
        operationId: "tui.manifest",
        responses: {
          200: {
            description: "Shared TUI manifest",
            content: {
              "application/json": {
                schema: resolver(TuiSurfaceManifest),
              },
            },
          },
        },
      }),
      async (c) => {
        const config = await TuiConfig.get().catch(() => ({}) as TuiConfig.Info)
        return c.json(
          createSurfaceManifest({
            keybinds: config.keybinds,
            android: c.req.query("platform") === "android",
          }),
        )
      },
    )
    .get(
      "/snapshot",
      describeRoute({
        summary: "Get shared TUI snapshot",
        description: "Return a normalized TUI snapshot that native renderers can display without duplicating Linux presenter logic.",
        operationId: "tui.snapshot",
        responses: {
          200: {
            description: "Shared TUI snapshot",
            content: {
              "application/json": {
                schema: resolver(TuiSurfaceSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      async (c) => {
        return c.json(await snapshot(c.req.valid("query").sessionID))
      },
    )
    .post(
      "/action",
      describeRoute({
        summary: "Dispatch shared TUI action",
        description: "Dispatch a typed action from a native TUI renderer through the shared TUI surface contract.",
        operationId: "tui.action",
        responses: {
          200: {
            description: "Action dispatched",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", TuiSurfaceAction),
      async (c) => {
        const action = c.req.valid("json")
        if (action.type === "command") {
          const command = commandMap[action.command]
          if (!command) return c.json(false)
          await Bus.publish(TuiEvent.CommandExecute, {
            command,
            viewID: Instance.viewID,
          })
          return c.json(true)
        }
        if (action.type === "session.select") {
          await Session.get(action.sessionID)
          await Bus.publish(TuiEvent.SessionSelect, {
            sessionID: action.sessionID,
            viewID: Instance.viewID,
          })
          return c.json(true)
        }
        if (action.type === "permission.reply") {
          const ok = await PermissionNext.reply({
            requestID: action.requestID,
            reply: action.reply,
            message: action.reason,
            sessionID: action.sessionID,
          })
          return c.json(ok)
        }
        return c.json(false)
      },
    )
    .post(
      "/append-prompt",
      describeRoute({
        summary: "Append TUI prompt",
        description: "Append prompt to the TUI",
        operationId: "tui.appendPrompt",
        responses: {
          200: {
            description: "Prompt processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", TuiEvent.PromptAppend.properties),
      async (c) => {
        await Bus.publish(TuiEvent.PromptAppend, scoped(c.req.valid("json")))
        return c.json(true)
      },
    )
    .post(
      "/open-help",
      describeRoute({
        summary: "Open help dialog",
        description: "Open the help dialog in the TUI to display user assistance information.",
        operationId: "tui.openHelp",
        responses: {
          200: {
            description: "Help dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "help.show",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/open-sessions",
      describeRoute({
        summary: "Open sessions dialog",
        description: "Open the session dialog",
        operationId: "tui.openSessions",
        responses: {
          200: {
            description: "Session dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "session.list",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/open-themes",
      describeRoute({
        summary: "Open themes dialog",
        description: "Open the theme dialog",
        operationId: "tui.openThemes",
        responses: {
          200: {
            description: "Theme dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "session.list",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/open-models",
      describeRoute({
        summary: "Open models dialog",
        description: "Open the model dialog",
        operationId: "tui.openModels",
        responses: {
          200: {
            description: "Model dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "model.list",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/submit-prompt",
      describeRoute({
        summary: "Submit TUI prompt",
        description: "Submit the prompt",
        operationId: "tui.submitPrompt",
        responses: {
          200: {
            description: "Prompt submitted successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "prompt.submit",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/clear-prompt",
      describeRoute({
        summary: "Clear TUI prompt",
        description: "Clear the prompt",
        operationId: "tui.clearPrompt",
        responses: {
          200: {
            description: "Prompt cleared successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Bus.publish(TuiEvent.CommandExecute, {
          command: "prompt.clear",
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/execute-command",
      describeRoute({
        summary: "Execute TUI command",
        description: "Execute a TUI command (e.g. agent_cycle)",
        operationId: "tui.executeCommand",
        responses: {
          200: {
            description: "Command executed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.object({ command: z.string() })),
      async (c) => {
        const command = c.req.valid("json").command
        await Bus.publish(TuiEvent.CommandExecute, {
          // @ts-expect-error
          command: {
            session_new: "session.new",
            session_share: "session.share",
            session_interrupt: "session.interrupt",
            session_compact: "session.compact",
            messages_page_up: "session.page.up",
            messages_page_down: "session.page.down",
            messages_line_up: "session.line.up",
            messages_line_down: "session.line.down",
            messages_half_page_up: "session.half.page.up",
            messages_half_page_down: "session.half.page.down",
            messages_first: "session.first",
            messages_last: "session.last",
            agent_cycle: "agent.cycle",
          }[command],
          viewID: Instance.viewID,
        })
        return c.json(true)
      },
    )
    .post(
      "/show-toast",
      describeRoute({
        summary: "Show TUI toast",
        description: "Show a toast notification in the TUI",
        operationId: "tui.showToast",
        responses: {
          200: {
            description: "Toast notification shown successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("json", TuiEvent.ToastShow.properties),
      async (c) => {
        await Bus.publish(TuiEvent.ToastShow, scoped(c.req.valid("json")))
        return c.json(true)
      },
    )
    .post(
      "/publish",
      describeRoute({
        summary: "Publish TUI event",
        description: "Publish a TUI event",
        operationId: "tui.publish",
        responses: {
          200: {
            description: "Event published successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.union(
          Object.values(TuiEvent).map((def) => {
            return z
              .object({
                type: z.literal(def.type),
                properties: def.properties,
              })
              .meta({
                ref: "Event" + "." + def.type,
              })
          }),
        ),
      ),
      async (c) => {
        const evt = c.req.valid("json")
        await Bus.publish(Object.values(TuiEvent).find((def) => def.type === evt.type)!, scoped(evt.properties))
        return c.json(true)
      },
    )
    .post(
      "/select-session",
      describeRoute({
        summary: "Select session",
        description: "Navigate the TUI to display the specified session.",
        operationId: "tui.selectSession",
        responses: {
          200: {
            description: "Session selected successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", TuiEvent.SessionSelect.properties),
      async (c) => {
        const { sessionID } = c.req.valid("json")
        await Session.get(sessionID)
        await Bus.publish(TuiEvent.SessionSelect, { sessionID, viewID: Instance.viewID })
        return c.json(true)
      },
    )
    .route("/control", TuiControlRoutes),
)
