globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as defineMiddleware, s as sequence } from "./chunks/index_D1YjoXnb.mjs"
import "./chunks/astro-designed-error-pages_BPZvUdJP.mjs"
import { A as AstroUserError } from "./chunks/astro/server_z27GPXmP.mjs"
import { u as useTranslations } from "./chunks/translations_DM8BHxPC.mjs"

const localeAlias = {
  en: "root",
  root: "root",
}
function parse(input) {
  let decoded = ""
  try {
    decoded = decodeURIComponent(input)
  } catch {
    return null
  }
  const value = decoded.trim().toLowerCase()
  if (!value) return null
  return value
}
function exactLocale(input) {
  const value = parse(input)
  if (!value) return null
  if (value in localeAlias) {
    return localeAlias[value]
  }
  return null
}
function matchLocale(input) {
  const value = parse(input)
  if (!value) return null
  if (value in localeAlias) {
    return localeAlias[value]
  }
  if (value.startsWith("en")) return "root"
  return null
}

function docsAlias(pathname) {
  const hit = /^\/docs\/([^/]+)(\/.*)?$/.exec(pathname)
  if (!hit) return null
  const value = hit[1] ?? ""
  const tail = hit[2] ?? ""
  const locale = exactLocale(value)
  if (!locale) return null
  const next = locale === "root" ? `/docs${tail}` : `/docs/${locale}${tail}`
  if (next === pathname) return null
  return {
    path: next,
    locale,
  }
}
function cookie(locale) {
  const value = locale === "root" ? "en" : locale
  return `oc_locale=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}
function redirect(url, path, locale) {
  const next = new URL(url.toString())
  next.pathname = path
  const headers = new Headers({
    Location: next.toString(),
  })
  if (locale) headers.set("Set-Cookie", cookie(locale))
  return new Response(null, {
    status: 302,
    headers,
  })
}
function localeFromCookie(header) {
  if (!header) return null
  const raw = header
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("oc_locale="))
    ?.slice("oc_locale=".length)
  if (!raw) return null
  return matchLocale(raw)
}
function localeFromAcceptLanguage(header) {
  if (!header) return "root"
  const items = header
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const parts = raw.split(";").map((x) => x.trim())
      const lang = parts[0] ?? ""
      const q = parts
        .slice(1)
        .find((x) => x.startsWith("q="))
        ?.slice(2)
      return {
        lang,
        q: q ? Number.parseFloat(q) : 1,
      }
    })
    .sort((a, b) => b.q - a.q)
  const locale = items
    .map((item) => item.lang)
    .filter((lang) => lang && lang !== "*")
    .map((lang) => matchLocale(lang))
    .find((lang) => lang)
  return locale ?? "root"
}
const onRequest$3 = defineMiddleware((ctx, next) => {
  const alias = docsAlias(ctx.url.pathname)
  if (alias) {
    return redirect(ctx.url, alias.path, alias.locale)
  }
  if (ctx.url.pathname !== "/docs" && ctx.url.pathname !== "/docs/") return next()
  const locale =
    localeFromCookie(ctx.request.headers.get("cookie")) ??
    localeFromAcceptLanguage(ctx.request.headers.get("accept-language"))
  if (!locale || locale === "root") return next()
  return redirect(ctx.url, `/docs/${locale}/`)
})

const onRequest$2 = (context, next) => {
  if (context.isPrerendered) {
    context.locals.runtime ??= {
      env: process.env,
    }
  }
  return next()
}

const onRequest$1 = defineMiddleware(async (context, next) => {
  context.locals.t = useTranslations(context.currentLocale)
  initializeStarlightRoute(context)
  return next()
})
function initializeStarlightRoute(context) {
  if ("starlightRoute" in context.locals) return
  const state = { routeData: void 0 }
  Object.defineProperty(context.locals, "starlightRoute", {
    get() {
      if (!state.routeData) {
        throw new AstroUserError(
          "`locals.starlightRoute` is not defined",
          "This usually means a component that accesses `locals.starlightRoute` is being rendered outside of a Starlight page, which is not supported.\n\nIf this is a component you authored, you can do one of the following:\n\n1. Avoid using this component in non-Starlight pages.\n2. Wrap the code that reads `locals.starlightRoute` in a  `try/catch` block and handle the cases where `starlightRoute` is not available.\n\nIf this is a Starlight built-in or third-party component, you may need to report a bug or avoid this use of the component.",
        )
      }
      return state.routeData
    },
    set(routeData) {
      state.routeData = routeData
    },
  })
}

const onRequest = sequence(onRequest$2, onRequest$1, onRequest$3)

export { onRequest }
