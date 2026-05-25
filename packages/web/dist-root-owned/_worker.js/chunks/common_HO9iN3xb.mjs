globalThis.process ??= {}
globalThis.process.env ??= {}
import {
  c as createAstro,
  a as createComponent,
  r as renderComponent,
  b as renderTemplate,
} from "./astro/server_z27GPXmP.mjs"
import { r as renderEntry } from "./_astro_content_BNUh5GBc.mjs"
import {
  g as getRoute,
  a as attachRouteDataAndRunMiddleware,
  u as useRouteData,
  $ as $$Page,
} from "./middleware_cgHeIO0c.mjs"

const $$Astro = createAstro("https://dev.slopcode.ai")
const $$Common = createComponent(
  async ($$result, $$props, $$slots) => {
    const Astro2 = $$result.createAstro($$Astro, $$props, $$slots)
    Astro2.self = $$Common
    const route = await getRoute(Astro2)
    const renderResult = await renderEntry(route.entry)
    await attachRouteDataAndRunMiddleware(Astro2, await useRouteData(Astro2, route, renderResult))
    const { Content, entry } = Astro2.locals.starlightRoute
    return renderTemplate`${renderComponent($$result, "Page", $$Page, {}, { default: async ($$result2) => renderTemplate`${Content && renderTemplate`${renderComponent($$result2, "Content", Content, { frontmatter: entry.data })}`}` })}`
  },
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+2337ed27ed217285/node_modules/@astrojs/starlight/routes/common.astro",
  void 0,
)

export { $$Common as $ }
