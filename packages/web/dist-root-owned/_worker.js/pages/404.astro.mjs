globalThis.process ??= {}
globalThis.process.env ??= {}
import { a as createComponent, r as renderComponent, b as renderTemplate } from "../chunks/astro/server_z27GPXmP.mjs"
import { $ as $$Common } from "../chunks/common_HO9iN3xb.mjs"
export { renderers } from "../renderers.mjs"

const prerender = true
const $$404 = createComponent(
  ($$result, $$props, $$slots) => {
    return renderTemplate`${renderComponent($$result, "CommonPage", $$Common, {})}`
  },
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+2337ed27ed217285/node_modules/@astrojs/starlight/routes/static/404.astro",
  void 0,
)

const $$file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+2337ed27ed217285/node_modules/@astrojs/starlight/routes/static/404.astro"
const $$url = undefined

const _page = /*#__PURE__*/ Object.freeze(
  /*#__PURE__*/ Object.defineProperty(
    {
      __proto__: null,
      default: $$404,
      file: $$file,
      prerender,
      url: $$url,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
)

const page = () => _page

export { page }
