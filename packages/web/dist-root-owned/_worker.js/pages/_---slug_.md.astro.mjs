globalThis.process ??= {}
globalThis.process.env ??= {}
import { g as getCollection } from "../chunks/_astro_content_BNUh5GBc.mjs"
export { renderers } from "../renderers.mjs"

function notFoundText(locals) {
  if (typeof locals !== "object" || locals === null || !("t" in locals)) {
    return "share.not_found"
  }
  const t = locals.t
  if (typeof t !== "function") {
    return "share.not_found"
  }
  const text = t("share.not_found")
  if (typeof text === "string" && text.length > 0) {
    return text
  }
  return "share.not_found"
}
const GET = async ({ params, locals }) => {
  const slug = params.slug || "index"
  const docs = await getCollection("docs")
  const doc = docs.find((d) => d.id === slug)
  const notFound = notFoundText(locals)
  if (!doc) {
    return new Response(notFound, { status: 404, statusText: notFound })
  }
  return new Response(doc.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

const _page = /*#__PURE__*/ Object.freeze(
  /*#__PURE__*/ Object.defineProperty(
    {
      __proto__: null,
      GET,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
)

const page = () => _page

export { page }
