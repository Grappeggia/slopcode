import type { Hooks } from "@slopcode-ai/plugin"
import { createServer } from "http"
import { Installation } from "@/installation"
import { Log } from "@/util/log"
import type { Provider } from "@/provider/provider"

const log = Log.create({ service: "plugin.digitalocean" })

const clientID = "b1a6c5158156caac821fd1b30253ca8acb52454a48fa744420e41889cb589f82"
const authorizeURL = "https://cloud.digitalocean.com/v1/oauth/authorize"
const apiBase = "https://api.digitalocean.com"
const inferenceBase = "https://inference.do-ai.run/v1"
const port = 1456
const redirectPath = "/auth/callback"
const tokenPath = "/auth/token"
const makPrefix = "slopcode-oauth"

type TokenPayload = {
  access_token: string
  expires_in: number
  state: string
}

type Router = {
  name: string
  uuid?: string
  description?: string
}

let server: ReturnType<typeof createServer> | undefined
let pending:
  | {
      state: string
      resolve: (tokens: TokenPayload) => void
      reject: (error: Error) => void
    }
  | undefined

function state() {
  return crypto.getRandomValues(new Uint8Array(32)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")
}

function redirect() {
  return `http://localhost:${port}${redirectPath}`
}

function authorize(state: string) {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: clientID,
    redirect_uri: redirect(),
    scope: "genai:create genai:read",
    state,
  })
  return `${authorizeURL}?${params.toString()}`
}

const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>SlopCode - DigitalOcean Authorization</title></head>
  <body>
    <h1 id="title">Finishing sign-in...</h1>
    <p id="msg">You can close this window once sign-in completes.</p>
    <script>
      (async function() {
        const params = new URLSearchParams((window.location.hash || "").slice(1))
        const search = new URLSearchParams(window.location.search)
        const error = params.get("error") || search.get("error")
        const body = error
          ? { error, error_description: params.get("error_description") || search.get("error_description") || "" }
          : { access_token: params.get("access_token") || "", expires_in: params.get("expires_in") || "0", state: params.get("state") || "" }
        await fetch(${JSON.stringify(tokenPath)}, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        document.getElementById("title").textContent = error ? "Authorization Failed" : "Authorization Successful"
        document.getElementById("msg").textContent = error ? (body.error_description || error) : "You can close this window and return to SlopCode."
        if (!error) setTimeout(function() { window.close() }, 2000)
      })().catch(function(e) {
        document.getElementById("title").textContent = "Authorization Failed"
        document.getElementById("msg").textContent = String(e && e.message ? e.message : e)
      })
    </script>
  </body>
</html>`

async function start() {
  if (server) return
  server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`)
    if (req.method === "GET" && url.pathname === redirectPath) {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(html)
      return
    }
    if (req.method === "POST" && url.pathname === tokenPath) {
      const chunks: Buffer[] = []
      req.on("data", (chunk: Buffer) => chunks.push(chunk))
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, string>
        if (!pending) {
          res.writeHead(409, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "no_pending_oauth" }))
          return
        }
        if (body.error) {
          pending.reject(new Error(body.error_description || body.error))
          pending = undefined
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: true }))
          return
        }
        if (!body.access_token || body.state !== pending.state) {
          pending.reject(new Error(!body.access_token ? "Missing access_token in callback" : "Invalid state"))
          pending = undefined
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "invalid_callback" }))
          return
        }
        const expires = Number.parseInt(body.expires_in || "0", 10)
        pending.resolve({
          access_token: body.access_token,
          expires_in: Number.isFinite(expires) && expires > 0 ? expires : 60 * 60 * 24 * 30,
          state: body.state,
        })
        pending = undefined
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
      })
      return
    }
    res.writeHead(404)
    res.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server!.listen(port, () => resolve())
    server!.on("error", reject)
  })
}

function stop() {
  server?.close(() => log.info("digitalocean oauth server stopped"))
  server = undefined
}

function wait(state: string) {
  return new Promise<TokenPayload>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending = undefined
      reject(new Error("OAuth callback timeout - authorization took too long"))
    }, 5 * 60 * 1000)
    pending = {
      state,
      resolve(tokens) {
        clearTimeout(timer)
        resolve(tokens)
      },
      reject(error) {
        clearTimeout(timer)
        reject(error)
      },
    }
  })
}

async function createKey(bearer: string) {
  const response = await fetch(`${apiBase}/v2/gen-ai/models/api_keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "User-Agent": `slopcode/${Installation.VERSION}`,
    },
    body: JSON.stringify({ name: `${makPrefix}-${Math.floor(Date.now() / 1000)}` }),
  })
  if (!response.ok) throw new Error(`Failed to create Model Access Key (${response.status}): ${await response.text()}`)
  const data = (await response.json()) as { api_key_info?: { uuid: string; name: string; secret_key: string } }
  if (!data.api_key_info?.secret_key) throw new Error("Model Access Key response missing secret_key")
  return data.api_key_info
}

async function routers(bearer: string) {
  const response = await fetch(`${apiBase}/v2/gen-ai/models/routers`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      "User-Agent": `slopcode/${Installation.VERSION}`,
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
  if (!response?.ok) return []
  const body = (await response.json().catch(() => undefined)) as { model_routers?: Router[] } | undefined
  return body?.model_routers ?? []
}

function model(router: Router, providerID: string): Provider.Model {
  const id = `router:${router.name}`
  return {
    id,
    providerID,
    name: router.name,
    family: "digitalocean-inference-routers",
    api: { id, url: inferenceBase, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    headers: {},
    options: {},
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 128_000, output: 8_192 },
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
    variants: {},
  }
}

function cached(raw: string | undefined): Router[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) =>
      item && typeof item.name === "string" ? [{ name: item.name, uuid: item.uuid, description: item.description }] : [],
    )
  } catch {
    return []
  }
}

export async function DigitalOceanAuthPlugin(): Promise<Hooks> {
  return {
    provider: {
      id: "digitalocean",
      async models(provider, ctx) {
        const base = (provider as Provider.Info).models
        const metadata = (ctx.auth as { metadata?: Record<string, string> } | undefined)?.metadata ?? {}
        const merged: Record<string, Provider.Model> = { ...base }
        for (const router of cached(metadata.routers)) {
          const id = `router:${router.name}`
          if (!merged[id]) merged[id] = model(router, "digitalocean")
        }
        return merged
      },
    },
    auth: {
      provider: "digitalocean",
      methods: [
        {
          type: "oauth",
          label: "Login with DigitalOcean",
          async authorize() {
            await start()
            const nonce = state()
            const callback = wait(nonce)
            return {
              url: authorize(nonce),
              method: "auto" as const,
              instructions:
                "Sign in to DigitalOcean in your browser. SlopCode will create a Model Access Key named slopcode-oauth-* and load your Inference Routers. Re-run connect to refresh routers later.",
              async callback() {
                try {
                  const tokens = await callback
                  const key = await createKey(tokens.access_token)
                  const list = await routers(tokens.access_token)
                  return {
                    type: "success" as const,
                    provider: "digitalocean",
                    key: key.secret_key,
                    metadata: {
                      mak_uuid: key.uuid,
                      mak_name: key.name,
                      oauth_access: tokens.access_token,
                      oauth_expires: String(Date.now() + tokens.expires_in * 1000),
                      routers: JSON.stringify(list.map((router) => ({ name: router.name, uuid: router.uuid, description: router.description }))),
                      routers_fetched_at: String(Date.now()),
                    },
                  }
                } catch (error) {
                  log.error("digitalocean oauth callback failed", { error })
                  return { type: "failed" as const }
                } finally {
                  stop()
                }
              },
            }
          },
        },
        {
          type: "api",
          label: "Paste Model Access Key",
        },
      ],
    },
  }
}
