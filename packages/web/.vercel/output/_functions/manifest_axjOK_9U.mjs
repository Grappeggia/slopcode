import { g as decodeKey } from "./chunks/astro/server_CGASYgNY.mjs"
import "./chunks/astro-designed-error-pages_CW2lTvND.mjs"
import { N as NOOP_MIDDLEWARE_FN } from "./chunks/noop-middleware_DR3v5wNA.mjs"

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")]
      }
      return [key, value]
    }),
  )
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || ""
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`)
    }
    return params[part.content]
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]")
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("")
  return segmentPath ? "/" + segmentPath : ""
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params)
    let trailing = ""
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/"
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing
    return path || "/"
  }
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback)
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin,
  }
}

function deserializeManifest(serializedManifest) {
  const routes = []
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData),
    })
    const route = serializedRoute
    route.routeData = deserializeRouteData(serializedRoute.routeData)
  }
  const assets = new Set(serializedManifest.assets)
  const componentMetadata = new Map(serializedManifest.componentMetadata)
  const inlinedScripts = new Map(serializedManifest.inlinedScripts)
  const clientDirectives = new Map(serializedManifest.clientDirectives)
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap)
  const key = decodeKey(serializedManifest.key)
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN }
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key,
  }
}

const manifest = deserializeManifest({
  hrefRoot: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/",
  cacheDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/node_modules/.astro/",
  outDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/dist/",
  srcDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/",
  publicDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/public/",
  buildClientDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/dist/client/",
  buildServerDir: "file:///home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/dist/server/",
  adapterName: "@astrojs/vercel",
  routes: [
    {
      file: "",
      links: [],
      scripts: [],
      styles: [],
      routeData: {
        type: "page",
        component: "_server-islands.astro",
        params: ["name"],
        segments: [
          [{ content: "_server-islands", dynamic: false, spread: false }],
          [{ content: "name", dynamic: true, spread: false }],
        ],
        pattern: "^\\/_server-islands\\/([^/]+?)\\/?$",
        prerender: false,
        isIndex: false,
        fallbackRoutes: [],
        route: "/_server-islands/[name]",
        origin: "internal",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "404.html",
      links: [],
      scripts: [],
      styles: [],
      routeData: {
        type: "page",
        isIndex: false,
        route: "/404",
        pattern: "^\\/404\\/?$",
        segments: [[{ content: "404", dynamic: false, spread: false }]],
        params: [],
        component:
          "../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/404.astro",
        pathname: "/404",
        prerender: true,
        fallbackRoutes: [],
        distURL: [],
        origin: "external",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "",
      links: [],
      scripts: [{ type: "external", value: "/_astro/page.7qqag-5g.js" }],
      styles: [],
      routeData: {
        type: "endpoint",
        isIndex: false,
        route: "/_image",
        pattern: "^\\/_image\\/?$",
        segments: [[{ content: "_image", dynamic: false, spread: false }]],
        params: [],
        component:
          "../../node_modules/.bun/astro@5.7.13+1d941c09658a4b5a/node_modules/astro/dist/assets/endpoint/generic.js",
        pathname: "/_image",
        prerender: false,
        fallbackRoutes: [],
        origin: "internal",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "",
      links: [],
      scripts: [{ type: "external", value: "/_astro/page.7qqag-5g.js" }],
      styles: [],
      routeData: {
        type: "redirect",
        isIndex: false,
        route: "/docs",
        pattern: "^\\/docs\\/?$",
        segments: [[{ content: "docs", dynamic: false, spread: false }]],
        params: [],
        component: "/docs",
        pathname: "/docs",
        prerender: false,
        redirect: "/",
        fallbackRoutes: [],
        distURL: [],
        origin: "project",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "",
      links: [],
      scripts: [{ type: "external", value: "/_astro/page.7qqag-5g.js" }],
      styles: [],
      routeData: {
        type: "redirect",
        isIndex: false,
        route: "/docs/[...slug]",
        pattern: "^\\/docs(?:\\/(.*?))?\\/?$",
        segments: [
          [{ content: "docs", dynamic: false, spread: false }],
          [{ content: "...slug", dynamic: true, spread: true }],
        ],
        params: ["...slug"],
        component: "/docs/[...slug]",
        prerender: false,
        redirect: "/[...slug]",
        redirectRoute: {
          type: "page",
          isIndex: false,
          route: "/[...slug]",
          pattern: "^(?:\\/(.*?))?\\/?$",
          segments: [[{ content: "...slug", dynamic: true, spread: true }]],
          params: ["...slug"],
          component:
            "../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/index.astro",
          prerender: true,
          fallbackRoutes: [],
          distURL: [],
          origin: "external",
          _meta: { trailingSlash: "ignore" },
        },
        fallbackRoutes: [],
        distURL: [],
        origin: "project",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "",
      links: [],
      scripts: [{ type: "external", value: "/_astro/page.7qqag-5g.js" }],
      styles: [
        {
          type: "inline",
          content:
            "body>.page>.main-frame .main-pane>main>.content-panel:first-of-type{display:none}body>.page>.main-frame .main-pane>main{padding:0}body>.page>.main-frame .main-pane>main>.content-panel+.content-panel{border-top:none!important;padding:0}\n",
        },
        { type: "external", src: "/_astro/_id_.BzgDuL50.css" },
        {
          type: "inline",
          content:
            '@layer starlight.components{:root{--sl-badge-default-border: var(--sl-color-accent);--sl-badge-default-bg: var(--sl-color-accent-low);--sl-badge-default-text: #fff;--sl-badge-note-border: var(--sl-color-blue);--sl-badge-note-bg: var(--sl-color-blue-low);--sl-badge-note-text: #fff;--sl-badge-danger-border: var(--sl-color-red);--sl-badge-danger-bg: var(--sl-color-red-low);--sl-badge-danger-text: #fff;--sl-badge-success-border: var(--sl-color-green);--sl-badge-success-bg: var(--sl-color-green-low);--sl-badge-success-text: #fff;--sl-badge-caution-border: var(--sl-color-orange);--sl-badge-caution-bg: var(--sl-color-orange-low);--sl-badge-caution-text: #fff;--sl-badge-tip-border: var(--sl-color-purple);--sl-badge-tip-bg: var(--sl-color-purple-low);--sl-badge-tip-text: #fff}[data-theme=light]:root{--sl-badge-default-bg: var(--sl-color-accent-high);--sl-badge-note-bg: var(--sl-color-blue-high);--sl-badge-danger-bg: var(--sl-color-red-high);--sl-badge-success-bg: var(--sl-color-green-high);--sl-badge-caution-bg: var(--sl-color-orange-high);--sl-badge-tip-bg: var(--sl-color-purple-high)}.sl-badge:where(.astro-hfjcdq7b){display:inline-block;border:1px solid var(--sl-color-border-badge);border-radius:.25rem;font-family:var(--sl-font-system-mono);line-height:normal;color:var(--sl-color-text-badge);background-color:var(--sl-color-bg-badge);overflow-wrap:anywhere}.sidebar-content .sl-badge:where(.astro-hfjcdq7b){line-height:1;font-size:var(--sl-text-xs);padding:.125rem .375rem}.sidebar-content a[aria-current=page]>.sl-badge:where(.astro-hfjcdq7b){--sl-color-bg-badge: transparent;--sl-color-border-badge: currentColor;color:inherit}.default:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-default-bg);--sl-color-border-badge: var(--sl-badge-default-border);--sl-color-text-badge: var(--sl-badge-default-text)}.note:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-note-bg);--sl-color-border-badge: var(--sl-badge-note-border);--sl-color-text-badge: var(--sl-badge-note-text)}.danger:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-danger-bg);--sl-color-border-badge: var(--sl-badge-danger-border);--sl-color-text-badge: var(--sl-badge-danger-text)}.success:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-success-bg);--sl-color-border-badge: var(--sl-badge-success-border);--sl-color-text-badge: var(--sl-badge-success-text)}.tip:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-tip-bg);--sl-color-border-badge: var(--sl-badge-tip-border);--sl-color-text-badge: var(--sl-badge-tip-text)}.caution:where(.astro-hfjcdq7b){--sl-color-bg-badge: var(--sl-badge-caution-bg);--sl-color-border-badge: var(--sl-badge-caution-border);--sl-color-text-badge: var(--sl-badge-caution-text)}.small:where(.astro-hfjcdq7b){font-size:var(--sl-text-xs);padding:.125rem .25rem}.medium:where(.astro-hfjcdq7b){font-size:var(--sl-text-sm);padding:.175rem .35rem}.large:where(.astro-hfjcdq7b){font-size:var(--sl-text-base);padding:.225rem .45rem}.sl-markdown-content :is(h1,h2,h3,h4,h5,h6) .sl-badge:where(.astro-hfjcdq7b){vertical-align:middle}}\n@layer starlight.components{svg:where(.astro-rwyredg4){color:var(--sl-icon-color);font-size:var(--sl-icon-size, 1em);width:1em;height:1em}}\n@layer starlight.components{starlight-tabs:where(.astro-pykqqpp3){display:block}.tablist-wrapper:where(.astro-pykqqpp3){overflow-x:auto}:where(.astro-pykqqpp3)[role=tablist]{display:flex;list-style:none;border-bottom:2px solid var(--sl-color-gray-5);padding:0}.tab:where(.astro-pykqqpp3){margin-bottom:-2px}.tab:where(.astro-pykqqpp3)>:where(.astro-pykqqpp3)[role=tab]{display:flex;align-items:center;gap:.5rem;padding:0 1.25rem;text-decoration:none;border-bottom:2px solid var(--sl-color-gray-5);color:var(--sl-color-gray-3);outline-offset:var(--sl-outline-offset-inside);overflow-wrap:initial}.tab:where(.astro-pykqqpp3) :where(.astro-pykqqpp3)[role=tab][aria-selected=true]{color:var(--sl-color-white);border-color:var(--sl-color-text-accent);font-weight:600}.tablist-wrapper:where(.astro-pykqqpp3)~[role=tabpanel]{margin-top:1rem}}\n@layer starlight.components{.sl-steps{--bullet-size: calc(var(--sl-line-height) * 1rem);--bullet-margin: .375rem;list-style:none;counter-reset:steps-counter var(--sl-steps-start, 0);padding-inline-start:0}.sl-steps>li{counter-increment:steps-counter;position:relative;padding-inline-start:calc(var(--bullet-size) + 1rem);padding-bottom:1px;min-height:calc(var(--bullet-size) + var(--bullet-margin))}.sl-steps>li+li{margin-top:0}.sl-steps>li:before{content:counter(steps-counter);position:absolute;top:0;inset-inline-start:0;width:var(--bullet-size);height:var(--bullet-size);line-height:var(--bullet-size);font-size:var(--sl-text-xs);font-weight:600;text-align:center;color:var(--sl-color-white);background-color:var(--sl-color-gray-6);border-radius:99rem;box-shadow:inset 0 0 0 1px var(--sl-color-gray-5)}.sl-steps>li:after{--guide-width: 1px;content:"";position:absolute;top:calc(var(--bullet-size) + var(--bullet-margin));bottom:var(--bullet-margin);inset-inline-start:calc((var(--bullet-size) - var(--guide-width)) / 2);width:var(--guide-width);background-color:var(--sl-color-hairline-light)}}@layer starlight.content{.sl-steps>li>:first-child{--lh: calc(1em * var(--sl-line-height));--shift-y: calc(.5 * (var(--bullet-size) - var(--lh)));transform:translateY(var(--shift-y));margin-bottom:var(--shift-y)}.sl-steps>li>:first-child:where(h1,h2,h3,h4,h5,h6){--lh: calc(1em * var(--sl-line-height-headings))}@supports (--prop: 1lh){.sl-steps>li>:first-child{--lh: 1lh}}}\n@layer starlight.components{.sl-link-button:where(.astro-ztgayirm){align-items:center;border:1px solid transparent;border-radius:999rem;display:inline-flex;font-size:var(--sl-text-sm);gap:.5em;line-height:1.1875;outline-offset:.25rem;padding:.4375rem 1.125rem;text-decoration:none}.sl-link-button:where(.astro-ztgayirm).primary{background:var(--sl-color-text-accent);border-color:var(--sl-color-text-accent);color:var(--sl-color-black)}.sl-link-button:where(.astro-ztgayirm).primary:hover{color:var(--sl-color-black)}.sl-link-button:where(.astro-ztgayirm).secondary{border-color:inherit;color:var(--sl-color-white)}.sl-link-button:where(.astro-ztgayirm).minimal{color:var(--sl-color-white);padding-inline:0}.sl-link-button:where(.astro-ztgayirm) svg{flex-shrink:0}@media(min-width:50rem){.sl-link-button:where(.astro-ztgayirm){font-size:var(--sl-text-base);padding:.9375rem 1.25rem}}.sl-markdown-content .sl-link-button:where(.astro-ztgayirm){margin-inline-end:1rem}.sl-markdown-content .sl-link-button:where(.astro-ztgayirm):not(:where(p *)){margin-block:1rem}}\n',
        },
        { type: "external", src: "/_astro/Share.DI-MEA2z.css" },
      ],
      routeData: {
        route: "/s/[id]",
        isIndex: false,
        type: "page",
        pattern: "^\\/s\\/([^/]+?)\\/?$",
        segments: [
          [{ content: "s", dynamic: false, spread: false }],
          [{ content: "id", dynamic: true, spread: false }],
        ],
        params: ["id"],
        component: "src/pages/s/[id].astro",
        prerender: false,
        fallbackRoutes: [],
        distURL: [],
        origin: "project",
        _meta: { trailingSlash: "ignore" },
      },
    },
    {
      file: "",
      links: [],
      scripts: [{ type: "external", value: "/_astro/page.7qqag-5g.js" }],
      styles: [],
      routeData: {
        route: "/[...slug].md",
        isIndex: false,
        type: "endpoint",
        pattern: "^\\/(.*?)\\.md\\/?$",
        segments: [
          [
            { content: "...slug", dynamic: true, spread: true },
            { content: ".md", dynamic: false, spread: false },
          ],
        ],
        params: ["...slug"],
        component: "src/pages/[...slug].md.ts",
        prerender: false,
        fallbackRoutes: [],
        distURL: [],
        origin: "project",
        _meta: { trailingSlash: "ignore" },
      },
    },
  ],
  site: "https://dev.slopcode.ai",
  base: "/",
  trailingSlash: "ignore",
  compressHTML: true,
  componentMetadata: [
    ["\u0000astro:content", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/common.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/404.astro",
      { propagation: "in-tree", containsHead: true },
    ],
    [
      "\u0000@astro-page:../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/404@_@astro",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000@astrojs-ssr-virtual-entry", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/index.astro",
      { propagation: "in-tree", containsHead: true },
    ],
    [
      "\u0000@astro-page:../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/index@_@astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/utils/routing/data.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/utils/starlight-page.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/StarlightPage.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/pages/s/[id].astro",
      { propagation: "in-tree", containsHead: true },
    ],
    ["\u0000@astro-page:src/pages/s/[id]@_@astro", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/utils/routing/index.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/utils/navigation.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/SidebarPersister.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Sidebar.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000virtual:starlight/components/Sidebar", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Page.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/SidebarSublist.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/utils/translations.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/internal.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000virtual:astro-expressive-code/preprocess-config", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro-expressive-code@0.41.6+d4a9ca0ffe30da47/node_modules/astro-expressive-code/components/renderer.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro-expressive-code@0.41.6+d4a9ca0ffe30da47/node_modules/astro-expressive-code/components/Code.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro-expressive-code@0.41.6+d4a9ca0ffe30da47/node_modules/astro-expressive-code/components/index.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Footer.astro",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000virtual:starlight/components/Footer", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/.astro/content-modules.mjs",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro@5.7.13+1d941c09658a4b5a/node_modules/astro/dist/content/runtime.js",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/acp.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/acp.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/index.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/index.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tui.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tui.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/windows-wsl.mdx",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/windows-wsl.mdx?astroPropagatedAssets",
      { propagation: "in-tree", containsHead: false },
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/locals.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000astro-internal:middleware", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content.config.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000virtual:starlight/collection-config", { propagation: "in-tree", containsHead: false }],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/pages/[...slug].md.ts",
      { propagation: "in-tree", containsHead: false },
    ],
    ["\u0000@astro-page:src/pages/[...slug].md@_@ts", { propagation: "in-tree", containsHead: false }],
  ],
  renderers: [],
  clientDirectives: [
    [
      "idle",
      '(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value=="object"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};"requestIdleCallback"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event("astro:idle"));})();',
    ],
    [
      "load",
      '(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event("astro:load"));})();',
    ],
    [
      "media",
      '(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener("change",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event("astro:media"));})();',
    ],
    [
      "only",
      '(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event("astro:only"));})();',
    ],
    [
      "visible",
      '(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value=="object"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event("astro:visible"));})();',
    ],
  ],
  entryModules: {
    "\u0000@astrojs-ssr-adapter": "_@astrojs-ssr-adapter.mjs",
    "\u0000noop-actions": "_noop-actions.mjs",
    "\u0000@astro-page:../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/404@_@astro":
      "pages/404.astro.mjs",
    "\u0000@astro-page:src/pages/[...slug].md@_@ts": "pages/_---slug_.md.astro.mjs",
    "\u0000@astro-page:../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/index@_@astro":
      "pages/_---slug_.astro.mjs",
    "\u0000@astrojs-ssr-virtual-entry": "entry.mjs",
    "\u0000@astro-page:../../node_modules/.bun/astro@5.7.13+1d941c09658a4b5a/node_modules/astro/dist/assets/endpoint/generic@_@js":
      "pages/_image.astro.mjs",
    "\u0000astro-internal:middleware": "_astro-internal_middleware.mjs",
    "\u0000@astro-renderers": "renderers.mjs",
    "\u0000@astro-page:src/pages/s/[id]@_@astro": "pages/s/_id_.astro.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/.astro/content-assets.mjs":
      "chunks/content-assets_DleWbedO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/.astro/content-modules.mjs":
      "chunks/content-modules_E-jUvBBk.mjs",
    "\u0000astro:data-layer-content": "chunks/_astro_data-layer-content_DuKhFML4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro@5.7.13+1d941c09658a4b5a/node_modules/astro/dist/assets/services/sharp.js":
      "chunks/sharp_DP2UgUJb.mjs",
    "\u0000virtual:astro-expressive-code/config": "chunks/config_BNkHRQhY.mjs",
    "\u0000virtual:starlight/collection-config": "chunks/collection-config_DQMqhgqf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/agents.mdx?astroPropagatedAssets":
      "chunks/agents_YbXMB3tN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/acp.mdx?astroPropagatedAssets":
      "chunks/acp_Cm4ETSvZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/cli.mdx?astroPropagatedAssets":
      "chunks/cli_lfgIN4IT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/commands.mdx?astroPropagatedAssets":
      "chunks/commands_BnU8AdRj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/config.mdx?astroPropagatedAssets":
      "chunks/config_D7pti0xJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_CbBu0Ica.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/changelog.mdx?astroPropagatedAssets":
      "chunks/changelog_C1A-4v_6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_C7NRWuYA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_B6G_WZte.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_ggUx67ZR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/github.mdx?astroPropagatedAssets":
      "chunks/github_BOjkDbUD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CclA7k3V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_G6FIdpgi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_BJzqBMcA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_BOAINJm8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/index.mdx?astroPropagatedAssets":
      "chunks/index_DEhrM6ZV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/models.mdx?astroPropagatedAssets":
      "chunks/models_CXdPSyIj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/go.mdx?astroPropagatedAssets":
      "chunks/go_BB9hqxA4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_C3Iv0JCN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/modes.mdx?astroPropagatedAssets":
      "chunks/modes_C9I_zJax.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/network.mdx?astroPropagatedAssets":
      "chunks/network_D7-lMuMJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_Brld-J_K.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DLQUhQ5Z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/rules.mdx?astroPropagatedAssets":
      "chunks/rules_AYOX8bwg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/platforms.mdx?astroPropagatedAssets":
      "chunks/platforms_n_nx72IZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_UgcNZGF8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/server.mdx?astroPropagatedAssets":
      "chunks/server_BGfbPwPt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/share.mdx?astroPropagatedAssets":
      "chunks/share_CXLOZhGM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/providers.mdx?astroPropagatedAssets":
      "chunks/providers_DHNnkl5H.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BIQB-W0d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/themes.mdx?astroPropagatedAssets":
      "chunks/themes_CCb1lpRh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tools.mdx?astroPropagatedAssets":
      "chunks/tools_C-k2vour.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_C7upr1Zo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tui.mdx?astroPropagatedAssets":
      "chunks/tui_lNgN85gl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/workflows.mdx?astroPropagatedAssets":
      "chunks/workflows_lQiuNnmX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/web.mdx?astroPropagatedAssets":
      "chunks/web_mNgIJCn3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/acp.mdx?astroPropagatedAssets":
      "chunks/acp_COA7zMIM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_CBqpRV5d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zen.mdx?astroPropagatedAssets":
      "chunks/zen_woRqvlyt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/agents.mdx?astroPropagatedAssets":
      "chunks/agents_D1gdqt-V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/cli.mdx?astroPropagatedAssets":
      "chunks/cli_l1t90Mpr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_Dl6L_hBZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_C29ymNHy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/commands.mdx?astroPropagatedAssets":
      "chunks/commands_BCflmVOr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_DiGD3T5V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/github.mdx?astroPropagatedAssets":
      "chunks/github_DaylBXOw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_D32vPTF5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CoBaufc9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/index.mdx?astroPropagatedAssets":
      "chunks/index_DkSmImSG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_BS_xMcSG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/config.mdx?astroPropagatedAssets":
      "chunks/config_D3QUZj-M.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_CLYFR-XT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_VY6cPB_f.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_FrWobesS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/models.mdx?astroPropagatedAssets":
      "chunks/models_C91S0zUf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/modes.mdx?astroPropagatedAssets":
      "chunks/modes_WGqaDzbo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/network.mdx?astroPropagatedAssets":
      "chunks/network_B3E5GUka.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BTwf1XAA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_BjE4GbwO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/rules.mdx?astroPropagatedAssets":
      "chunks/rules_CtVVwino.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/providers.mdx?astroPropagatedAssets":
      "chunks/providers_CIy5qRyk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_jXMz4nBK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/share.mdx?astroPropagatedAssets":
      "chunks/share_3ThaFl98.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/server.mdx?astroPropagatedAssets":
      "chunks/server_vVp6z5cf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BCctJimC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/themes.mdx?astroPropagatedAssets":
      "chunks/themes_BID6wDMG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DNmuBzyq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_DsbJ_kB7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tui.mdx?astroPropagatedAssets":
      "chunks/tui_CUaoo28x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/web.mdx?astroPropagatedAssets":
      "chunks/web_DAz_RUyI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_ZZZPfage.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DWr68cb9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/zen.mdx?astroPropagatedAssets":
      "chunks/zen_DwR9Fjee.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/cli.mdx?astroPropagatedAssets":
      "chunks/cli_BeN9PJZu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DikY5WCN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/commands.mdx?astroPropagatedAssets":
      "chunks/commands_DPJZKbrs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/config.mdx?astroPropagatedAssets":
      "chunks/config_DdT1GoNj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_Bq4Z9QVR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_Wa_Cqf0j.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_MqqAl5R4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_FkmGKt3f.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/github.mdx?astroPropagatedAssets":
      "chunks/github_WUjhH6np.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_Bu_iogVm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ide.mdx?astroPropagatedAssets":
      "chunks/ide_B3TMjvBs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_DHni1fmO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/index.mdx?astroPropagatedAssets":
      "chunks/index_zF6MrtxY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/models.mdx?astroPropagatedAssets":
      "chunks/models_CjXJaWZY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/modes.mdx?astroPropagatedAssets":
      "chunks/modes_C30L1f0X.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_-rhzYvrH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/network.mdx?astroPropagatedAssets":
      "chunks/network_DElCrK6b.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_CF_OGgTj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DIOmEV0Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_v9k8upcE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/rules.mdx?astroPropagatedAssets":
      "chunks/rules_hwgBQDHb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/providers.mdx?astroPropagatedAssets":
      "chunks/providers_HbEMOyfa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BkbyDjaK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/server.mdx?astroPropagatedAssets":
      "chunks/server_CH8BLBSv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BPcE-90z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/share.mdx?astroPropagatedAssets":
      "chunks/share_BXy_1gF8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/themes.mdx?astroPropagatedAssets":
      "chunks/themes_BRf7fn-w.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DxYPaERy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tui.mdx?astroPropagatedAssets":
      "chunks/tui_Cs7fw0bn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_DGzi8Pbn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DJIJ8hX7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_Dp3wXl6r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/web.mdx?astroPropagatedAssets":
      "chunks/web_jcfLWgMS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/agents.mdx?astroPropagatedAssets":
      "chunks/agents_D1LCFgKm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/cli.mdx?astroPropagatedAssets":
      "chunks/cli_C6uGmeOe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/commands.mdx?astroPropagatedAssets":
      "chunks/commands_G3RKesAJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_DW0tRP7a.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/config.mdx?astroPropagatedAssets":
      "chunks/config_BtKpMFVy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_BL0xVQLg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_Djv4dyf7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/github.mdx?astroPropagatedAssets":
      "chunks/github_Dm1lTnm9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_Y4FHq8Ib.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_BXUUFgYn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/zen.mdx?astroPropagatedAssets":
      "chunks/zen_BBL8kMjF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/ide.mdx?astroPropagatedAssets":
      "chunks/ide_BrpacbUU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_CsyemUYH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/models.mdx?astroPropagatedAssets":
      "chunks/models_CFLAuam5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_Du8N4KYF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/network.mdx?astroPropagatedAssets":
      "chunks/network_BTN-GgWK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/modes.mdx?astroPropagatedAssets":
      "chunks/modes_DvfCCteb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/index.mdx?astroPropagatedAssets":
      "chunks/index_DE8xwryK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_Mf5orjJJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_CaShIsKD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_BRxC2nfl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/rules.mdx?astroPropagatedAssets":
      "chunks/rules_DXTTTVfT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_CO4XiqP_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/providers.mdx?astroPropagatedAssets":
      "chunks/providers_EWoSycQI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/share.mdx?astroPropagatedAssets":
      "chunks/share_BNJ3VcVT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/skills.mdx?astroPropagatedAssets":
      "chunks/skills_B9NDKkPw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/themes.mdx?astroPropagatedAssets":
      "chunks/themes_BhcXz3Pv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/server.mdx?astroPropagatedAssets":
      "chunks/server_DlDoMJ-L.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tools.mdx?astroPropagatedAssets":
      "chunks/tools_BZOSH7HC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_D_6VZ3Wi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/web.mdx?astroPropagatedAssets":
      "chunks/web_ChXnAsRA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_CmpL0c4z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/zen.mdx?astroPropagatedAssets":
      "chunks/zen_BZjNqvD3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/acp.mdx?astroPropagatedAssets":
      "chunks/acp_CcO_6-bQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/agents.mdx?astroPropagatedAssets":
      "chunks/agents_D6MqpPrO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tui.mdx?astroPropagatedAssets":
      "chunks/tui_oEaBfZdq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/commands.mdx?astroPropagatedAssets":
      "chunks/commands_CLoOb_UK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_eW8cL6Wd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/config.mdx?astroPropagatedAssets":
      "chunks/config_NUix7d0G.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DX_dflsx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_DpHi7p0e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_JL9lduGp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_C4JR-wgI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/index.mdx?astroPropagatedAssets":
      "chunks/index_HN4HrIb3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DBHz5Ro1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/github.mdx?astroPropagatedAssets":
      "chunks/github_CdTDwURh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ide.mdx?astroPropagatedAssets":
      "chunks/ide_GRDHFrFn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_C-iQhhaf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_D941EmzW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/models.mdx?astroPropagatedAssets":
      "chunks/models_OujK6tnh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_CZfksFVA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/modes.mdx?astroPropagatedAssets":
      "chunks/modes_BDZZ2PWx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/network.mdx?astroPropagatedAssets":
      "chunks/network_DFJVhrY5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BFTOHNAC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_B4wiwqGX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/providers.mdx?astroPropagatedAssets":
      "chunks/providers_DlGFwHdK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/rules.mdx?astroPropagatedAssets":
      "chunks/rules_DxuPVvwA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_Cz0vzYLj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/server.mdx?astroPropagatedAssets":
      "chunks/server_Dc4IN_IK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/share.mdx?astroPropagatedAssets":
      "chunks/share_b-E3la-A.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BqCGNCRf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/themes.mdx?astroPropagatedAssets":
      "chunks/themes_BTwcVjQs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_DlZYblcl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DqP9vIqf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/web.mdx?astroPropagatedAssets":
      "chunks/web_t6ZBpTwb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_C6F1QH2K.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/acp.mdx?astroPropagatedAssets":
      "chunks/acp_B9PGc2_6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/zen.mdx?astroPropagatedAssets":
      "chunks/zen_Ys_VdiKp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DjCtZpip.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/commands.mdx?astroPropagatedAssets":
      "chunks/commands_D4lMo4rc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tui.mdx?astroPropagatedAssets":
      "chunks/tui_D0MxJBwI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/cli.mdx?astroPropagatedAssets":
      "chunks/cli_Cr688Mgl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/config.mdx?astroPropagatedAssets":
      "chunks/config_C0KBjK8Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_CCzzndS3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_B5FMa8mf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_BdEMF-ME.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_Cnl4-9Yg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/github.mdx?astroPropagatedAssets":
      "chunks/github_CBXOozBp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DwzxEFhw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/ide.mdx?astroPropagatedAssets":
      "chunks/ide_D8objsIZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_a1B1qVYY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_keyHmpFp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/models.mdx?astroPropagatedAssets":
      "chunks/models_B-nn0t8E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/modes.mdx?astroPropagatedAssets":
      "chunks/modes_DX8NndtF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/network.mdx?astroPropagatedAssets":
      "chunks/network_D6bhOBmx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BcvpPmEo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_BgmN1hqe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_C5EIWLLb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/index.mdx?astroPropagatedAssets":
      "chunks/index_BqHVJXYi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/rules.mdx?astroPropagatedAssets":
      "chunks/rules_WWG42P9T.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/providers.mdx?astroPropagatedAssets":
      "chunks/providers_B8BYPIQZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_gF56zAyZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/server.mdx?astroPropagatedAssets":
      "chunks/server_V9RTIdp7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/share.mdx?astroPropagatedAssets":
      "chunks/share_C4qoPpSQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/skills.mdx?astroPropagatedAssets":
      "chunks/skills_CIWhhI7d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/themes.mdx?astroPropagatedAssets":
      "chunks/themes_nSnLpaLc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DOaSBfhP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tui.mdx?astroPropagatedAssets":
      "chunks/tui_CN44m2jY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/web.mdx?astroPropagatedAssets":
      "chunks/web_zxEczo_9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_DGEVZ0X_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/zen.mdx?astroPropagatedAssets":
      "chunks/zen_C9qNWOxP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/acp.mdx?astroPropagatedAssets":
      "chunks/acp_ClPcrSf3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_DVYn2kzx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/agents.mdx?astroPropagatedAssets":
      "chunks/agents_CnoF56OO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_DfZnPDgZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_DSmRr9CP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/commands.mdx?astroPropagatedAssets":
      "chunks/commands_3IUbf3G8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_OvGgL3Oh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_BM_9efsr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/config.mdx?astroPropagatedAssets":
      "chunks/config_DlYjr1so.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/github.mdx?astroPropagatedAssets":
      "chunks/github_6Wl2TW2k.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_Aphq7zWL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DX8mRYLI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CqR7Y7Za.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/index.mdx?astroPropagatedAssets":
      "chunks/index_NnsZQFAk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_DBkXgT8I.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/models.mdx?astroPropagatedAssets":
      "chunks/models_CxruSvVw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_JEwfde99.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_BYOq0AZ-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/modes.mdx?astroPropagatedAssets":
      "chunks/modes_Ck2ohHEa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/network.mdx?astroPropagatedAssets":
      "chunks/network_DAtlAI1a.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BW6uvTHp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DzlF_KCb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/providers.mdx?astroPropagatedAssets":
      "chunks/providers_BrT2Oqw6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/rules.mdx?astroPropagatedAssets":
      "chunks/rules_C2yNzIwc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/share.mdx?astroPropagatedAssets":
      "chunks/share_DLIeoVGt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BYrh0xv8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BAPQYNsi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/server.mdx?astroPropagatedAssets":
      "chunks/server_zLPmLqyM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/themes.mdx?astroPropagatedAssets":
      "chunks/themes_DsQHj01I.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_516VkAZp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tools.mdx?astroPropagatedAssets":
      "chunks/tools_D5u6PyIF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/web.mdx?astroPropagatedAssets":
      "chunks/web_BiDWOaQS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_CDqA8A9s.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/zen.mdx?astroPropagatedAssets":
      "chunks/zen_BgGwbXjp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DTB_eNaL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DHx7_tbF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/commands.mdx?astroPropagatedAssets":
      "chunks/commands_qRSfH1SW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tui.mdx?astroPropagatedAssets":
      "chunks/tui_CZBeuEND.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/config.mdx?astroPropagatedAssets":
      "chunks/config_BxBBLCqW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_k0NSUIXJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/cli.mdx?astroPropagatedAssets":
      "chunks/cli_2SLyoBYi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_BGDtPwwj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_Bu4kb88u.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_BertCfTw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/github.mdx?astroPropagatedAssets":
      "chunks/github_Cwo1KiD1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_B5TDISEw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ide.mdx?astroPropagatedAssets":
      "chunks/ide_BOjt44JP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/index.mdx?astroPropagatedAssets":
      "chunks/index_vF1qvkyW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_CMIYFvmj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_BdKrn4fb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/models.mdx?astroPropagatedAssets":
      "chunks/models_c-XjjcJ3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_KANNIRUP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/modes.mdx?astroPropagatedAssets":
      "chunks/modes_aHg6fLk4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/network.mdx?astroPropagatedAssets":
      "chunks/network_DN41SPK9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BZwJxotX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/rules.mdx?astroPropagatedAssets":
      "chunks/rules_DStqnoPN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_kjHs1kNo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_C7bLcuMS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/providers.mdx?astroPropagatedAssets":
      "chunks/providers_CXLFJwyr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/share.mdx?astroPropagatedAssets":
      "chunks/share_mh4cjKdR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/server.mdx?astroPropagatedAssets":
      "chunks/server_D2jYvGIN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/skills.mdx?astroPropagatedAssets":
      "chunks/skills_YUt714GQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/themes.mdx?astroPropagatedAssets":
      "chunks/themes_Br1kjbHt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DiuZk8wa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_Bx1f2_d9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/web.mdx?astroPropagatedAssets":
      "chunks/web_D6unXdCL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/zen.mdx?astroPropagatedAssets":
      "chunks/zen_DKikgfdE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DHP9xQ27.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/agents.mdx?astroPropagatedAssets":
      "chunks/agents_Cj6qR87n.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/commands.mdx?astroPropagatedAssets":
      "chunks/commands_B8JlRx3R.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tui.mdx?astroPropagatedAssets":
      "chunks/tui_DOwkWhWX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/config.mdx?astroPropagatedAssets":
      "chunks/config_FWH-WXPI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_l4ReECpO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_Bv_mgsHg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_Bau5mQ1Y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_Bp2eE6_5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_DKgrzASs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/cli.mdx?astroPropagatedAssets":
      "chunks/cli_TsS7BjmC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/github.mdx?astroPropagatedAssets":
      "chunks/github_COR0XaPR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_CRh55dL3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/ide.mdx?astroPropagatedAssets":
      "chunks/ide_DLeuRYf8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_g6uoZpNC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/index.mdx?astroPropagatedAssets":
      "chunks/index_B-4yksji.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_CQ-2KtBR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/models.mdx?astroPropagatedAssets":
      "chunks/models_BEKAXKlr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/modes.mdx?astroPropagatedAssets":
      "chunks/modes_BRPfIxkU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/network.mdx?astroPropagatedAssets":
      "chunks/network_CG84CEee.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BRVVEJQH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_B5kBAg-p.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_MpkNkNvC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/providers.mdx?astroPropagatedAssets":
      "chunks/providers_Cy8et7_s.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/rules.mdx?astroPropagatedAssets":
      "chunks/rules_DkOzkrT5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BsTUQCWb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/server.mdx?astroPropagatedAssets":
      "chunks/server_D5thZH3N.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/share.mdx?astroPropagatedAssets":
      "chunks/share_Bt6D0rHu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BHwYw5jZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/themes.mdx?astroPropagatedAssets":
      "chunks/themes_BUxZFWQh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tools.mdx?astroPropagatedAssets":
      "chunks/tools_CYjr63r_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tui.mdx?astroPropagatedAssets":
      "chunks/tui_BgdJ-_pr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/web.mdx?astroPropagatedAssets":
      "chunks/web_Dcsn7Q9E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_fVcddTfa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/zen.mdx?astroPropagatedAssets":
      "chunks/zen_sjW92Nkw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/acp.mdx?astroPropagatedAssets":
      "chunks/acp_Dr9uQTjp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/agents.mdx?astroPropagatedAssets":
      "chunks/agents__jPJF1Nl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_CJctMxzO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/commands.mdx?astroPropagatedAssets":
      "chunks/commands_DAAvcVaO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/cli.mdx?astroPropagatedAssets":
      "chunks/cli_BXDlF4IP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_CJfwypUa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_Cnz7lNeF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_DRexIuTH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/config.mdx?astroPropagatedAssets":
      "chunks/config_BMU4b_Gs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_DlKO-HNN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/github.mdx?astroPropagatedAssets":
      "chunks/github_DkEg8rdz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DlgeDFDQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CAU6qQ28.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/index.mdx?astroPropagatedAssets":
      "chunks/index_C_JcUpiR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_ni92kL_w.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_i-ht4N4x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/models.mdx?astroPropagatedAssets":
      "chunks/models_D_EJ1ICT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/modes.mdx?astroPropagatedAssets":
      "chunks/modes_BonouqEQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/network.mdx?astroPropagatedAssets":
      "chunks/network_DbhSXop4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_CLFFrhMp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_Cfi0l7ml.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_CgHHrSbZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_Bgq0YJir.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/server.mdx?astroPropagatedAssets":
      "chunks/server_K-frUT9K.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/share.mdx?astroPropagatedAssets":
      "chunks/share_DQiRXO1E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/skills.mdx?astroPropagatedAssets":
      "chunks/skills_DlHKx3Qg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/themes.mdx?astroPropagatedAssets":
      "chunks/themes_DvUdcAG0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tools.mdx?astroPropagatedAssets":
      "chunks/tools_C2CvsacT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tui.mdx?astroPropagatedAssets":
      "chunks/tui_DQ6S7avG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/web.mdx?astroPropagatedAssets":
      "chunks/web_C9pQKnFB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_BtyM7pCu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/zen.mdx?astroPropagatedAssets":
      "chunks/zen_CeJD6_3L.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/acp.mdx?astroPropagatedAssets":
      "chunks/acp_BzSzQrXX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/agents.mdx?astroPropagatedAssets":
      "chunks/agents_eRAVNAtz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/providers.mdx?astroPropagatedAssets":
      "chunks/providers_CEtg1-mE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/rules.mdx?astroPropagatedAssets":
      "chunks/rules_DVOWuuv_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/cli.mdx?astroPropagatedAssets":
      "chunks/cli_CUo4AG4G.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/commands.mdx?astroPropagatedAssets":
      "chunks/commands_4Ml5R08e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_BZqJGIaJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/config.mdx?astroPropagatedAssets":
      "chunks/config_TQB4t4rD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_ChSqlQUp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_DdyqXL_n.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_Df0RBkpC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_C1awwo3q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/github.mdx?astroPropagatedAssets":
      "chunks/github_D1ZYkCUi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/ide.mdx?astroPropagatedAssets":
      "chunks/ide_Ds-mPk-x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_8-oukLal.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/index.mdx?astroPropagatedAssets":
      "chunks/index_CJxHo-ox.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_DpuvqeiJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_DyMWD9Df.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_B8MiQrHX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/models.mdx?astroPropagatedAssets":
      "chunks/models_BJ_01TbM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/modes.mdx?astroPropagatedAssets":
      "chunks/modes_B6zsts5Z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/network.mdx?astroPropagatedAssets":
      "chunks/network_uj7i7Kbd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_B3ogE9Dv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DgDqMxVt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/providers.mdx?astroPropagatedAssets":
      "chunks/providers_mfy-nlAb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/rules.mdx?astroPropagatedAssets":
      "chunks/rules_CrNEQkk6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BrEAiAQl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/server.mdx?astroPropagatedAssets":
      "chunks/server_CnYxo26F.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/share.mdx?astroPropagatedAssets":
      "chunks/share_Cm6npcku.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/skills.mdx?astroPropagatedAssets":
      "chunks/skills_CymnCxEu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/themes.mdx?astroPropagatedAssets":
      "chunks/themes_CFJHb5NG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DKr7mVm-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_ge0zjy9m.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_BH0Bwfbt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/web.mdx?astroPropagatedAssets":
      "chunks/web_CpgmTTK6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/acp.mdx?astroPropagatedAssets":
      "chunks/acp_Bq55K7Bc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/zen.mdx?astroPropagatedAssets":
      "chunks/zen_CFwEXn_w.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tui.mdx?astroPropagatedAssets":
      "chunks/tui_DUw8_Lp-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/agents.mdx?astroPropagatedAssets":
      "chunks/agents_BUl7zH9W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/cli.mdx?astroPropagatedAssets":
      "chunks/cli_CeaFqXb8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/commands.mdx?astroPropagatedAssets":
      "chunks/commands_CemnFaSd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/config.mdx?astroPropagatedAssets":
      "chunks/config_C5yLXCRh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_BZkBK7Su.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_Ba8ZzlEn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_CGAC8a3l.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_CQs_mrE7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/github.mdx?astroPropagatedAssets":
      "chunks/github_CHzi7-3T.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_BL65ARru.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/ide.mdx?astroPropagatedAssets":
      "chunks/ide_DtulgFET.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_Cc-a2VYa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_CDGOmeES.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_BzOsXxRG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/models.mdx?astroPropagatedAssets":
      "chunks/models_CpyGEtD8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/modes.mdx?astroPropagatedAssets":
      "chunks/modes_CRx-vZZ2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/network.mdx?astroPropagatedAssets":
      "chunks/network_CguCprzN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/index.mdx?astroPropagatedAssets":
      "chunks/index_BIKtgQcJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_DYrEZwv-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DAJTf_5Z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/providers.mdx?astroPropagatedAssets":
      "chunks/providers_BQ9hBoRo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/rules.mdx?astroPropagatedAssets":
      "chunks/rules_CDjliSqW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_DE5GG1mY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/server.mdx?astroPropagatedAssets":
      "chunks/server_eijcm7Yl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/share.mdx?astroPropagatedAssets":
      "chunks/share_BfpAauSR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BYkC87Vt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/themes.mdx?astroPropagatedAssets":
      "chunks/themes_D69QSKht.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tools.mdx?astroPropagatedAssets":
      "chunks/tools_D447d0n3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/web.mdx?astroPropagatedAssets":
      "chunks/web_BJ1rSyAo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_JJwSdPQs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_D2JbZ1NL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/acp.mdx?astroPropagatedAssets":
      "chunks/acp_riX_ksuU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/zen.mdx?astroPropagatedAssets":
      "chunks/zen_C4b6PBTY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DsGmrDnA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DY_OoYpm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tui.mdx?astroPropagatedAssets":
      "chunks/tui_C_J8CqQp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_DB3cw05o.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem__0wJXY0t.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_DlVwoUr2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_DFn9XSfu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/github.mdx?astroPropagatedAssets":
      "chunks/github_BW38bM3P.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DTYVG9mn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ide.mdx?astroPropagatedAssets":
      "chunks/ide_DAbDYK7c.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/commands.mdx?astroPropagatedAssets":
      "chunks/commands_Bj8eeG5S.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_CguQmAAh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/config.mdx?astroPropagatedAssets":
      "chunks/config_dmIBj7Mp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_a7Qgf-J4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/index.mdx?astroPropagatedAssets":
      "chunks/index_192dwgH3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_BryDBnDc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/models.mdx?astroPropagatedAssets":
      "chunks/models_C-6qoH0y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/modes.mdx?astroPropagatedAssets":
      "chunks/modes_D06WkSap.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/network.mdx?astroPropagatedAssets":
      "chunks/network_Bl9ZQkOq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_CoSrtKwA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_B2UsnSq8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/providers.mdx?astroPropagatedAssets":
      "chunks/providers_H2elC_ZH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/rules.mdx?astroPropagatedAssets":
      "chunks/rules_B8igvEhE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BWDCwsMm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/server.mdx?astroPropagatedAssets":
      "chunks/server_CBHO5GaF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/share.mdx?astroPropagatedAssets":
      "chunks/share_AZS9w1s7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/skills.mdx?astroPropagatedAssets":
      "chunks/skills_CUB1IqC6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/themes.mdx?astroPropagatedAssets":
      "chunks/themes_D2YR3j8V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_CMeJSxv-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tools.mdx?astroPropagatedAssets":
      "chunks/tools_CmcMm9Ue.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tui.mdx?astroPropagatedAssets":
      "chunks/tui_CSByn0P8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/web.mdx?astroPropagatedAssets":
      "chunks/web_Cn37N4N5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_cjBF3AL3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/zen.mdx?astroPropagatedAssets":
      "chunks/zen_Cf4SjnF3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/acp.mdx?astroPropagatedAssets":
      "chunks/acp_CRuJNNni.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DCKj94mH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/commands.mdx?astroPropagatedAssets":
      "chunks/commands_QCa66TI7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_BJEw6zJC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DHG_uBKe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/config.mdx?astroPropagatedAssets":
      "chunks/config_B3iGyvOR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_D5sZCJGk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_BSIW-lEq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_C4gkNAkh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/github.mdx?astroPropagatedAssets":
      "chunks/github_5SM-5U_U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DABC49mP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/ide.mdx?astroPropagatedAssets":
      "chunks/ide_B67W40dY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/index.mdx?astroPropagatedAssets":
      "chunks/index_BXU0oybm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_DqYOLFmg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_RqQpFTWf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_DkJHUQh7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/models.mdx?astroPropagatedAssets":
      "chunks/models_ekUtDN4W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/modes.mdx?astroPropagatedAssets":
      "chunks/modes_DGXuT33v.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/network.mdx?astroPropagatedAssets":
      "chunks/network_BoDdqDjx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_CfYUAq1h.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DxJhqb1R.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/rules.mdx?astroPropagatedAssets":
      "chunks/rules_uNQ0Ckye.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/providers.mdx?astroPropagatedAssets":
      "chunks/providers_Dlz1DdoL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_CyXM55Sk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/server.mdx?astroPropagatedAssets":
      "chunks/server_Cy4f_GHW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/share.mdx?astroPropagatedAssets":
      "chunks/share_D9yvYFKu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/themes.mdx?astroPropagatedAssets":
      "chunks/themes_Cf4lmWjP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/skills.mdx?astroPropagatedAssets":
      "chunks/skills_CV1hpc7s.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tools.mdx?astroPropagatedAssets":
      "chunks/tools_D5WRw3Qk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_CLX2su_V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/web.mdx?astroPropagatedAssets":
      "chunks/web_C4A3T1aO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_Com6kQwR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tui.mdx?astroPropagatedAssets":
      "chunks/tui_DpQomMd8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/zen.mdx?astroPropagatedAssets":
      "chunks/zen_CNhE103a.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/acp.mdx?astroPropagatedAssets":
      "chunks/acp_C0O7VIu6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/agents.mdx?astroPropagatedAssets":
      "chunks/agents_hTq2dnrU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/commands.mdx?astroPropagatedAssets":
      "chunks/commands_BKWwQMRM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DtNsGhpx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/config.mdx?astroPropagatedAssets":
      "chunks/config_D69c-vmk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_Bb1mx147.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_BhD4R0GA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_C-jx7HBM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_a02JnWqy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/github.mdx?astroPropagatedAssets":
      "chunks/github_yMJY07zN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_DyzJkWRx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CRKFUzbM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_DOP9OLWD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/index.mdx?astroPropagatedAssets":
      "chunks/index_DV12CNwH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_CJuWvFMG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_BOipvm-Y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/models.mdx?astroPropagatedAssets":
      "chunks/models_Dha314i_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/network.mdx?astroPropagatedAssets":
      "chunks/network_BE2iSfWO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/modes.mdx?astroPropagatedAssets":
      "chunks/modes_Bz77nkvg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_BuL3QFy9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_D3jloT18.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/rules.mdx?astroPropagatedAssets":
      "chunks/rules_BDYM6JeS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_DVKgkM1n.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/server.mdx?astroPropagatedAssets":
      "chunks/server_ClEWE6Rq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/providers.mdx?astroPropagatedAssets":
      "chunks/providers_Bf7ztVdu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/share.mdx?astroPropagatedAssets":
      "chunks/share_BWL_v_UJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/skills.mdx?astroPropagatedAssets":
      "chunks/skills_oIZJEW_E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/themes.mdx?astroPropagatedAssets":
      "chunks/themes_Ppq1ZGzn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tools.mdx?astroPropagatedAssets":
      "chunks/tools_DNIGumGC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/web.mdx?astroPropagatedAssets":
      "chunks/web_B_3TYSRI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tui.mdx?astroPropagatedAssets":
      "chunks/tui_DiLD6KIt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DKILFzHg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_vnlAgahV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_BgmeORDL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/agents.mdx?astroPropagatedAssets":
      "chunks/agents_DpDNYTE-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/cli.mdx?astroPropagatedAssets":
      "chunks/cli_wL9CPpgg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/zen.mdx?astroPropagatedAssets":
      "chunks/zen_IgOrhJhq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/commands.mdx?astroPropagatedAssets":
      "chunks/commands_DeXv2W8o.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/config.mdx?astroPropagatedAssets":
      "chunks/config_kqQbhVNV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_D5N09Edu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_CoV8i3t2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_B_Wh7dbI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_xwGuTCtV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/github.mdx?astroPropagatedAssets":
      "chunks/github_CwxTLYOZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_iRUA_3BQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/ide.mdx?astroPropagatedAssets":
      "chunks/ide_Dnoc8hc6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/index.mdx?astroPropagatedAssets":
      "chunks/index_T5ckf2nE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_Ccg5KOyK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_Bq6OljT8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_DRopPxLf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/models.mdx?astroPropagatedAssets":
      "chunks/models_pTGdmIUi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/modes.mdx?astroPropagatedAssets":
      "chunks/modes_DC7FY7Zz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_DffY5_3t.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/providers.mdx?astroPropagatedAssets":
      "chunks/providers_BorjZ4Ob.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/network.mdx?astroPropagatedAssets":
      "chunks/network_BOr7OvwN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/rules.mdx?astroPropagatedAssets":
      "chunks/rules_9abVeVGk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_ofb5BQ94.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_Cdb5S3_Z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/share.mdx?astroPropagatedAssets":
      "chunks/share_d1fAWf0x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/skills.mdx?astroPropagatedAssets":
      "chunks/skills_BAeHaFjH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/server.mdx?astroPropagatedAssets":
      "chunks/server_BpYBUyTb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/themes.mdx?astroPropagatedAssets":
      "chunks/themes_DU1icDq9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tools.mdx?astroPropagatedAssets":
      "chunks/tools_v3QR1AGZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/web.mdx?astroPropagatedAssets":
      "chunks/web_D6A5PlQf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_7LhKOjcZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_7mFcHajP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/zen.mdx?astroPropagatedAssets":
      "chunks/zen_DQWKw9DZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/cli.mdx?astroPropagatedAssets":
      "chunks/cli_DxEmtLqX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tui.mdx?astroPropagatedAssets":
      "chunks/tui_wcPGO5_b.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/commands.mdx?astroPropagatedAssets":
      "chunks/commands_DMXbiVX5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/acp.mdx?astroPropagatedAssets":
      "chunks/acp_DgUcYkS2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/config.mdx?astroPropagatedAssets":
      "chunks/config_Ckqzyd5q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_X0ih1cGD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_CC3fxB8k.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_B4pMwgib.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_C2eXhLf5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/agents.mdx?astroPropagatedAssets":
      "chunks/agents_BWylYijT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/github.mdx?astroPropagatedAssets":
      "chunks/github_CPnFQVWp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ide.mdx?astroPropagatedAssets":
      "chunks/ide_CKB4SeiA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_Bmxw6f2J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/index.mdx?astroPropagatedAssets":
      "chunks/index_DKD-COpT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_DmBOYftF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_D-FKR4EJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_BFmiF8vT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/models.mdx?astroPropagatedAssets":
      "chunks/models_DvQSGP1W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/modes.mdx?astroPropagatedAssets":
      "chunks/modes_BySNlAYu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/network.mdx?astroPropagatedAssets":
      "chunks/network_Clqb8aw1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_D9y_m2MA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_NG2GkF-J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/providers.mdx?astroPropagatedAssets":
      "chunks/providers_dqBTdDTx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/rules.mdx?astroPropagatedAssets":
      "chunks/rules_b1Z6JWYU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk_BbxQ9fYQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/server.mdx?astroPropagatedAssets":
      "chunks/server_DotvxPPp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/share.mdx?astroPropagatedAssets":
      "chunks/share_DBXMBt2n.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/skills.mdx?astroPropagatedAssets":
      "chunks/skills_8KWWf-ht.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/themes.mdx?astroPropagatedAssets":
      "chunks/themes_OPHTSSCu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tools.mdx?astroPropagatedAssets":
      "chunks/tools_CAw4M5tm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_-Xj_toF0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/web.mdx?astroPropagatedAssets":
      "chunks/web_C6Oz0G1O.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/zen.mdx?astroPropagatedAssets":
      "chunks/zen_BRVAZOAD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/acp.mdx?astroPropagatedAssets":
      "chunks/acp_BD54Qki9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_C1pjw10M.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/agents.mdx?astroPropagatedAssets":
      "chunks/agents_ScE-FafH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/commands.mdx?astroPropagatedAssets":
      "chunks/commands_B4xxen7b.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/config.mdx?astroPropagatedAssets":
      "chunks/config_DKBtg8pK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tui.mdx?astroPropagatedAssets":
      "chunks/tui_Dqzu2QOP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/custom-tools.mdx?astroPropagatedAssets":
      "chunks/custom-tools_CYVnZw-R.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx?astroPropagatedAssets":
      "chunks/cli_BdOdYXbi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/enterprise.mdx?astroPropagatedAssets":
      "chunks/enterprise_rIhQbrlw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/formatters.mdx?astroPropagatedAssets":
      "chunks/formatters_BsP_v56U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/github.mdx?astroPropagatedAssets":
      "chunks/github_D__0s7bP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/gitlab.mdx?astroPropagatedAssets":
      "chunks/gitlab_X8OgIjYI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ide.mdx?astroPropagatedAssets":
      "chunks/ide_6D0NwAok.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/index.mdx?astroPropagatedAssets":
      "chunks/index_6fZWzK3x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ecosystem.mdx?astroPropagatedAssets":
      "chunks/ecosystem_tqbmWzFL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/lsp.mdx?astroPropagatedAssets":
      "chunks/lsp_Duyv1_fk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/mcp-servers.mdx?astroPropagatedAssets":
      "chunks/mcp-servers_CbnW69ns.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/models.mdx?astroPropagatedAssets":
      "chunks/models_QJztF5vu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/keybinds.mdx?astroPropagatedAssets":
      "chunks/keybinds_AIr-S9wO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/modes.mdx?astroPropagatedAssets":
      "chunks/modes_CjRrwCgq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/network.mdx?astroPropagatedAssets":
      "chunks/network_B_Deg4Yf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/plugins.mdx?astroPropagatedAssets":
      "chunks/plugins_DkHqVxPb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/permissions.mdx?astroPropagatedAssets":
      "chunks/permissions_pYXqZljW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/providers.mdx?astroPropagatedAssets":
      "chunks/providers_0WFJYCh3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/rules.mdx?astroPropagatedAssets":
      "chunks/rules_BxnMgA7U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/sdk.mdx?astroPropagatedAssets":
      "chunks/sdk__I-skkrN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/server.mdx?astroPropagatedAssets":
      "chunks/server_DLLB5gxe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/share.mdx?astroPropagatedAssets":
      "chunks/share_ng_OvwKz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/skills.mdx?astroPropagatedAssets":
      "chunks/skills_CSFMFsqk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/themes.mdx?astroPropagatedAssets":
      "chunks/themes_Ofjt-Gf1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tools.mdx?astroPropagatedAssets":
      "chunks/tools_bdzHpyzH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/web.mdx?astroPropagatedAssets":
      "chunks/web_-w2HpbWQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/windows-wsl.mdx?astroPropagatedAssets":
      "chunks/windows-wsl_4BotUECH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/zen.mdx?astroPropagatedAssets":
      "chunks/zen_X7t0uUA8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/troubleshooting.mdx?astroPropagatedAssets":
      "chunks/troubleshooting_DE7p41Km.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tui.mdx?astroPropagatedAssets":
      "chunks/tui_CmciN1Hu.mjs",
    "\u0000virtual:astro-expressive-code/ec-config": "chunks/ec-config_CzTTOeiV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/agents.mdx":
      "chunks/agents_D-XqjoTq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/acp.mdx":
      "chunks/acp_DiC2tjuW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/cli.mdx":
      "chunks/cli_zYPBSrVK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/commands.mdx":
      "chunks/commands_DKZUyXK6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/config.mdx":
      "chunks/config_BUeamT-h.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/custom-tools.mdx":
      "chunks/custom-tools_Ck_fAH7j.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ecosystem.mdx":
      "chunks/ecosystem_Achd2Y-g.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/enterprise.mdx":
      "chunks/enterprise_BhGdqCbu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/formatters.mdx":
      "chunks/formatters_DxhNR_fS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/github.mdx":
      "chunks/github_CtrJxK1l.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ide.mdx":
      "chunks/ide_ChjL26BQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/gitlab.mdx":
      "chunks/gitlab_yz8mW8ld.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/keybinds.mdx":
      "chunks/keybinds_DpP4xcd8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/lsp.mdx":
      "chunks/lsp_tUuHCRVC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/index.mdx":
      "chunks/index_C4jj39dJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/models.mdx":
      "chunks/models_JVT6EO6S.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/go.mdx":
      "chunks/go_BgtA7ZzK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/mcp-servers.mdx":
      "chunks/mcp-servers_BGxhbLhc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/modes.mdx":
      "chunks/modes_DiFn2RG7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/network.mdx":
      "chunks/network_ZbmXwQ3b.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/permissions.mdx":
      "chunks/permissions_HNoG-z4w.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/plugins.mdx":
      "chunks/plugins_v9EblB_E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/rules.mdx":
      "chunks/rules_C-HeoVC9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/platforms.mdx":
      "chunks/platforms_Mn5zDASf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/sdk.mdx":
      "chunks/sdk_EZkWRDSc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/server.mdx":
      "chunks/server_CSsBB2QS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/share.mdx":
      "chunks/share_BxvSux26.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/providers.mdx":
      "chunks/providers_D-ISeyXV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/skills.mdx":
      "chunks/skills_CoL1OCy5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/themes.mdx":
      "chunks/themes_wZvPJtcw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tools.mdx":
      "chunks/tools_DVndgH5l.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/troubleshooting.mdx":
      "chunks/troubleshooting_NAZOIHz5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tui.mdx":
      "chunks/tui_gmdJGosb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/workflows.mdx":
      "chunks/workflows_755QajfO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/web.mdx":
      "chunks/web_CaBPG3vS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/acp.mdx":
      "chunks/acp_b7DxpyZa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/windows-wsl.mdx":
      "chunks/windows-wsl_X0xqMJR6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zen.mdx":
      "chunks/zen_CtCGAc_u.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/agents.mdx":
      "chunks/agents_D9ODSGCv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/cli.mdx":
      "chunks/cli_h_G8mcEY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ecosystem.mdx":
      "chunks/ecosystem_DwgrtRvF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/enterprise.mdx":
      "chunks/enterprise_CgFmNDme.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/commands.mdx":
      "chunks/commands_BeypzHuO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/formatters.mdx":
      "chunks/formatters_DWiwUU7j.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/github.mdx":
      "chunks/github_BE7HopHi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/gitlab.mdx":
      "chunks/gitlab_Cp4h6vxV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ide.mdx":
      "chunks/ide_zWSSo_k2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/index.mdx":
      "chunks/index_DiNzpgvS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/lsp.mdx":
      "chunks/lsp_C5eU9OhZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/config.mdx":
      "chunks/config_hOzUwNT7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/custom-tools.mdx":
      "chunks/custom-tools_BDoVGpdb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/keybinds.mdx":
      "chunks/keybinds_CLi-L2V-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/mcp-servers.mdx":
      "chunks/mcp-servers_BkWkApif.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/models.mdx":
      "chunks/models_CSAX3yia.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/modes.mdx":
      "chunks/modes_tSxVrFck.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/network.mdx":
      "chunks/network_xA1yDvy2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/permissions.mdx":
      "chunks/permissions_CPMQYdQm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/plugins.mdx":
      "chunks/plugins_DL8_XTp_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/rules.mdx":
      "chunks/rules_9DNd4dI0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/providers.mdx":
      "chunks/providers_BDIf25Yd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/sdk.mdx":
      "chunks/sdk_DbKx5Ktl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/share.mdx":
      "chunks/share_CT1DHZOB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/server.mdx":
      "chunks/server_g-RnpYlX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/skills.mdx":
      "chunks/skills_Dz_6E23r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/themes.mdx":
      "chunks/themes_CUalAaI4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tools.mdx":
      "chunks/tools_DFlwTebH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/troubleshooting.mdx":
      "chunks/troubleshooting_C0EsPM4j.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/tui.mdx":
      "chunks/tui_xoMMSBHa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/web.mdx":
      "chunks/web_DNl8MKmo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/windows-wsl.mdx":
      "chunks/windows-wsl_LJYGHbSp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/acp.mdx":
      "chunks/acp_BNTt_v6M.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/zen.mdx":
      "chunks/zen_COU65XrO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/cli.mdx":
      "chunks/cli_Cj6UhfK2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/agents.mdx":
      "chunks/agents_CxZaEYyy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/commands.mdx":
      "chunks/commands_C4fZTRAh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/config.mdx":
      "chunks/config_DVRxUF03.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/custom-tools.mdx":
      "chunks/custom-tools_DRyH0zq7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ecosystem.mdx":
      "chunks/ecosystem_C-XaFbMH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/enterprise.mdx":
      "chunks/enterprise_CFJYvWPD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/formatters.mdx":
      "chunks/formatters_DQ2E1S0J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/github.mdx":
      "chunks/github_sC7iPgQL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/gitlab.mdx":
      "chunks/gitlab_lUPBeQV_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ide.mdx":
      "chunks/ide_CzatHRJo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/mcp-servers.mdx":
      "chunks/mcp-servers_Dlq2KZbi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/index.mdx":
      "chunks/index_DrLk4IXW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/models.mdx":
      "chunks/models_D-NCNuHa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/modes.mdx":
      "chunks/modes_BkHLE1RM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/keybinds.mdx":
      "chunks/keybinds_BjkN3f_h.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/network.mdx":
      "chunks/network_ByS9UAE0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/permissions.mdx":
      "chunks/permissions_Bjiiaknz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/plugins.mdx":
      "chunks/plugins_BJeOcAMv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/lsp.mdx":
      "chunks/lsp_DJGn0KvV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/rules.mdx":
      "chunks/rules_DtDnsNPL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/providers.mdx":
      "chunks/providers_CPKoU8Gu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/sdk.mdx":
      "chunks/sdk_DboSkqGI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/server.mdx":
      "chunks/server_CqhnwfcE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/skills.mdx":
      "chunks/skills_BA3jD_Fe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/share.mdx":
      "chunks/share_D3LW3-On.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/themes.mdx":
      "chunks/themes_DZE7KzJC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tools.mdx":
      "chunks/tools_iPdL88oN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/tui.mdx":
      "chunks/tui_dGctq23i.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/troubleshooting.mdx":
      "chunks/troubleshooting_B43itoTt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/acp.mdx":
      "chunks/acp_h1k1w95T.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/windows-wsl.mdx":
      "chunks/windows-wsl_CXsxgd7Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/web.mdx":
      "chunks/web_BGFfZ1jJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/agents.mdx":
      "chunks/agents_6Ct-_BvR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/cli.mdx":
      "chunks/cli_B2s_GLff.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/commands.mdx":
      "chunks/commands_CYuptvi0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/custom-tools.mdx":
      "chunks/custom-tools_BYRySuSa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/config.mdx":
      "chunks/config_BONTzEpp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/ecosystem.mdx":
      "chunks/ecosystem_DCrxV44H.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/enterprise.mdx":
      "chunks/enterprise_D8qVpQe9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/github.mdx":
      "chunks/github_nNddtHtI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/formatters.mdx":
      "chunks/formatters_CaTNbHSs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/gitlab.mdx":
      "chunks/gitlab_Cb0VSojX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/zen.mdx":
      "chunks/zen_CuV4Vsro.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/ide.mdx":
      "chunks/ide_DyPMYss_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/lsp.mdx":
      "chunks/lsp_D1UmRQl0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/models.mdx":
      "chunks/models_qQO9YkXw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/mcp-servers.mdx":
      "chunks/mcp-servers_C4kbGEtg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/network.mdx":
      "chunks/network_Dp6e6xdj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/modes.mdx":
      "chunks/modes_G7dlWRMy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/index.mdx":
      "chunks/index_BdFkNDXF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/permissions.mdx":
      "chunks/permissions_BWsv14e6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/plugins.mdx":
      "chunks/plugins_BGaQwcjw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/keybinds.mdx":
      "chunks/keybinds_BQZ3Uyw2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/rules.mdx":
      "chunks/rules_BzVkx_X3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/sdk.mdx":
      "chunks/sdk_Bm28pKiK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/providers.mdx":
      "chunks/providers_t0GyEYkb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/share.mdx":
      "chunks/share_vnd1eC5p.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/skills.mdx":
      "chunks/skills_lj2h_l56.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/themes.mdx":
      "chunks/themes_DVWfMLd2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/server.mdx":
      "chunks/server_CnEykuCw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tools.mdx":
      "chunks/tools_Bd4bszon.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/troubleshooting.mdx":
      "chunks/troubleshooting_DYeDlD7v.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/web.mdx":
      "chunks/web_Bdjsma-y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/windows-wsl.mdx":
      "chunks/windows-wsl_DrtmsA5W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/zen.mdx":
      "chunks/zen_CZ2EtHt3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/acp.mdx":
      "chunks/acp_jDpX23IC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/agents.mdx":
      "chunks/agents_B8o4koWb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/tui.mdx":
      "chunks/tui_Cf-QLlwM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/commands.mdx":
      "chunks/commands_JbLc5S5Z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/custom-tools.mdx":
      "chunks/custom-tools_BPh3MoJi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/config.mdx":
      "chunks/config_Du3juiEB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/cli.mdx":
      "chunks/cli_QdEwol1-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ecosystem.mdx":
      "chunks/ecosystem_7rhjWy0e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/enterprise.mdx":
      "chunks/enterprise_BArVWYYl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/formatters.mdx":
      "chunks/formatters_C3YPVb1v.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/index.mdx":
      "chunks/index_CugzkqD6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/gitlab.mdx":
      "chunks/gitlab_inW0cmfx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/github.mdx":
      "chunks/github_BLdbuvEE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ide.mdx":
      "chunks/ide_BL1D08pS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/lsp.mdx":
      "chunks/lsp_BbIn6jlb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/keybinds.mdx":
      "chunks/keybinds_CfD6Rwa2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/models.mdx":
      "chunks/models_BXpnlgOE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/mcp-servers.mdx":
      "chunks/mcp-servers_BXQebzph.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/modes.mdx":
      "chunks/modes_XXVaQECu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/network.mdx":
      "chunks/network_DiqnTb9s.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/permissions.mdx":
      "chunks/permissions_DK1wgmkY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/plugins.mdx":
      "chunks/plugins_B1VFmSWB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/providers.mdx":
      "chunks/providers_CWsF2aip.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/rules.mdx":
      "chunks/rules_BJXvB4od.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/sdk.mdx":
      "chunks/sdk_jszsvq-m.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/server.mdx":
      "chunks/server_MPQNMZHY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/share.mdx":
      "chunks/share_nA68Och3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/skills.mdx":
      "chunks/skills_0kjBMmYa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/themes.mdx":
      "chunks/themes_CRVGXh6q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/troubleshooting.mdx":
      "chunks/troubleshooting_cHBUBH3d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tools.mdx":
      "chunks/tools_DsFFDUOY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/web.mdx":
      "chunks/web_By5lhISF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/windows-wsl.mdx":
      "chunks/windows-wsl_CMn5PTge.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/acp.mdx":
      "chunks/acp_-rTETi25.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/zen.mdx":
      "chunks/zen_CAwtCoES.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/agents.mdx":
      "chunks/agents_ChIeYAKL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/commands.mdx":
      "chunks/commands_CI_KzKxZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/tui.mdx":
      "chunks/tui_Ba-wMJfl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/cli.mdx":
      "chunks/cli_RwRJcxMh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/config.mdx":
      "chunks/config_CVsvWOtD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/custom-tools.mdx":
      "chunks/custom-tools_C4vHXGAa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/enterprise.mdx":
      "chunks/enterprise_yVThqEgs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/ecosystem.mdx":
      "chunks/ecosystem_5pfS4HRt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/formatters.mdx":
      "chunks/formatters_dfyFXn-J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/github.mdx":
      "chunks/github_B6z2QCry.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/gitlab.mdx":
      "chunks/gitlab_D-f84a2B.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/ide.mdx":
      "chunks/ide_DBcirhDn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/lsp.mdx":
      "chunks/lsp_DTfBrdxs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/mcp-servers.mdx":
      "chunks/mcp-servers_fog1XW51.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/models.mdx":
      "chunks/models_Dgvuyj6S.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/modes.mdx":
      "chunks/modes_BsTv9vgY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/network.mdx":
      "chunks/network_BNdjcK8y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/permissions.mdx":
      "chunks/permissions_ODjIJSpT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/keybinds.mdx":
      "chunks/keybinds_BuScBxnq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/plugins.mdx":
      "chunks/plugins_DTtikYgW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/index.mdx":
      "chunks/index_CiPc1hir.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/rules.mdx":
      "chunks/rules_C9Bw2Fvz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/providers.mdx":
      "chunks/providers_BYf6KQjF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/sdk.mdx":
      "chunks/sdk_OjC590B1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/server.mdx":
      "chunks/server_BzYYflpF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/share.mdx":
      "chunks/share_BjI0h0Bk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/skills.mdx":
      "chunks/skills_BnAFqHoc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/themes.mdx":
      "chunks/themes_RTuPjsfr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tools.mdx":
      "chunks/tools__1mGHKPD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/tui.mdx":
      "chunks/tui_ByuoN-9x.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/web.mdx":
      "chunks/web_CgFsLQXD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/windows-wsl.mdx":
      "chunks/windows-wsl_DiFVVRwR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/zen.mdx":
      "chunks/zen_Y-yqVc4y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/acp.mdx":
      "chunks/acp_BdjvvrWG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/fr/troubleshooting.mdx":
      "chunks/troubleshooting_B_sul6gI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/agents.mdx":
      "chunks/agents_BB7IOcoj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/custom-tools.mdx":
      "chunks/custom-tools_BAazjGpF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/ecosystem.mdx":
      "chunks/ecosystem_7S8OgJsr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/commands.mdx":
      "chunks/commands_DFslpCsA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/enterprise.mdx":
      "chunks/enterprise_0QHvvKOA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/formatters.mdx":
      "chunks/formatters_DBGv5wYL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/config.mdx":
      "chunks/config_BTw06Uu0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/github.mdx":
      "chunks/github_BiJmt6HZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/gitlab.mdx":
      "chunks/gitlab_DgTcg3cD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/cli.mdx":
      "chunks/cli_Cvg9_f-5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/ide.mdx":
      "chunks/ide_Bv1TAiUM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/index.mdx":
      "chunks/index_c3XocL3A.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/lsp.mdx":
      "chunks/lsp_DUNnBQwA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/models.mdx":
      "chunks/models_HyaYxplu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/mcp-servers.mdx":
      "chunks/mcp-servers_BQaDxmvE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/keybinds.mdx":
      "chunks/keybinds_Bjg3UM-G.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/modes.mdx":
      "chunks/modes_DeolR6aw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/network.mdx":
      "chunks/network_DDfB38K7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/permissions.mdx":
      "chunks/permissions_DOdn-dBi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/plugins.mdx":
      "chunks/plugins_ugmNRU7n.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/providers.mdx":
      "chunks/providers_BwnF8Qzd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/rules.mdx":
      "chunks/rules_D3ms_0_5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/share.mdx":
      "chunks/share_XKJky-W_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/skills.mdx":
      "chunks/skills_C8Q5iESG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/sdk.mdx":
      "chunks/sdk_Chrn-qWD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/server.mdx":
      "chunks/server_C1fb_DGF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/themes.mdx":
      "chunks/themes_xDXvMC3X.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/troubleshooting.mdx":
      "chunks/troubleshooting_Ba2hMnax.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tools.mdx":
      "chunks/tools_1TzNLGOz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/web.mdx":
      "chunks/web_BgO7NpCu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/windows-wsl.mdx":
      "chunks/windows-wsl_BEaEos0Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/zen.mdx":
      "chunks/zen_tvE8vxDs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/acp.mdx":
      "chunks/acp_CeItdGMp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/agents.mdx":
      "chunks/agents_Dk6QgSeJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/commands.mdx":
      "chunks/commands_B4ugw_Rf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/es/tui.mdx":
      "chunks/tui_CAvR3-0e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/config.mdx":
      "chunks/config_BelOOZ34.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/custom-tools.mdx":
      "chunks/custom-tools_DFKb4Cs-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/cli.mdx":
      "chunks/cli_DrYRg6MW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ecosystem.mdx":
      "chunks/ecosystem_Hqk8tpYJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/enterprise.mdx":
      "chunks/enterprise_Dua54wM7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/formatters.mdx":
      "chunks/formatters_DjgTrskN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/github.mdx":
      "chunks/github_D2Eyg-PH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/gitlab.mdx":
      "chunks/gitlab_DdCTYZyQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ide.mdx":
      "chunks/ide_BiJuDzKK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/index.mdx":
      "chunks/index_D65ZAn7q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/lsp.mdx":
      "chunks/lsp_DCvkzi2r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/mcp-servers.mdx":
      "chunks/mcp-servers_DnnJE3zS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/models.mdx":
      "chunks/models_BYUYDQ9K.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/keybinds.mdx":
      "chunks/keybinds_DkMNDZSw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/modes.mdx":
      "chunks/modes_BfVZrip0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/network.mdx":
      "chunks/network_DZzq1RMD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/permissions.mdx":
      "chunks/permissions_DjNAzSbb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/rules.mdx":
      "chunks/rules_C4dIWTVC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/plugins.mdx":
      "chunks/plugins_D9z_-S6D.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/sdk.mdx":
      "chunks/sdk_IpoGqJsb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/providers.mdx":
      "chunks/providers_opzwCQ1R.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/share.mdx":
      "chunks/share_Bb8xiKdY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/server.mdx":
      "chunks/server_BVeB9g9v.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/skills.mdx":
      "chunks/skills_D2VVN3fu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/themes.mdx":
      "chunks/themes_DC9VoLwV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tools.mdx":
      "chunks/tools_CVessYE5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/windows-wsl.mdx":
      "chunks/windows-wsl_Jv_DYx0E.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/web.mdx":
      "chunks/web_BBMGL-ml.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/zen.mdx":
      "chunks/zen_DlBia_dL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/acp.mdx":
      "chunks/acp_D3Nn9yVQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/agents.mdx":
      "chunks/agents_DCaLMmkE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/commands.mdx":
      "chunks/commands_Niu8w8g7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/tui.mdx":
      "chunks/tui_DLTASCH5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/config.mdx":
      "chunks/config_DpAQTdKI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/custom-tools.mdx":
      "chunks/custom-tools_C93DiHWu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/troubleshooting.mdx":
      "chunks/troubleshooting_D1Pm8Dx3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/ecosystem.mdx":
      "chunks/ecosystem_xs8Y6wtt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/enterprise.mdx":
      "chunks/enterprise_DR6Ax3Ec.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/formatters.mdx":
      "chunks/formatters_BwGiFSDQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/cli.mdx":
      "chunks/cli_DbgNY89D.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/github.mdx":
      "chunks/github_DRhl2w6l.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/gitlab.mdx":
      "chunks/gitlab_BHABrqhA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/ide.mdx":
      "chunks/ide_ey_ftC-K.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/lsp.mdx":
      "chunks/lsp_CVyoYYPQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/index.mdx":
      "chunks/index_DlRZvakm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/mcp-servers.mdx":
      "chunks/mcp-servers_BfUtoBva.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/models.mdx":
      "chunks/models_Gj7ybfmX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/modes.mdx":
      "chunks/modes_fosyvre6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/network.mdx":
      "chunks/network_CRrU7y0s.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/permissions.mdx":
      "chunks/permissions_SFB7-179.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/plugins.mdx":
      "chunks/plugins_D58pXqsc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/keybinds.mdx":
      "chunks/keybinds_B0xjxrgC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/providers.mdx":
      "chunks/providers_RTYdPyfh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/rules.mdx":
      "chunks/rules_DBpbXl7Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/sdk.mdx":
      "chunks/sdk_DKAxE4S-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/server.mdx":
      "chunks/server_QnEzlCFB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/share.mdx":
      "chunks/share_B7VM_jEz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/skills.mdx":
      "chunks/skills_CN9WQk0B.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/themes.mdx":
      "chunks/themes_CMWtFTL1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tools.mdx":
      "chunks/tools_Bum35wFw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/tui.mdx":
      "chunks/tui_CXtpt8ie.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/web.mdx":
      "chunks/web_Ba1jbX_G.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/windows-wsl.mdx":
      "chunks/windows-wsl_Cz5908HJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/zen.mdx":
      "chunks/zen_DjHzkdLz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/acp.mdx":
      "chunks/acp_BDhidPu-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/agents.mdx":
      "chunks/agents_CAj0mlJE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/troubleshooting.mdx":
      "chunks/troubleshooting_CbAneToU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/commands.mdx":
      "chunks/commands_CHxSdj91.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/cli.mdx":
      "chunks/cli_D00lQfhS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/custom-tools.mdx":
      "chunks/custom-tools_ClVek4dF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/enterprise.mdx":
      "chunks/enterprise_CdPFgkOp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ecosystem.mdx":
      "chunks/ecosystem_Nz6nLhgh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/config.mdx":
      "chunks/config_C2oVrAoi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/formatters.mdx":
      "chunks/formatters_Dj9HKB86.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/github.mdx":
      "chunks/github_C66UtpLg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/gitlab.mdx":
      "chunks/gitlab_DvyAjhUZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ide.mdx":
      "chunks/ide_B4McNOq0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/index.mdx":
      "chunks/index_CL4zWh-I.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/lsp.mdx":
      "chunks/lsp_TGHMjJPO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/mcp-servers.mdx":
      "chunks/mcp-servers_CMJJ0hyx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/models.mdx":
      "chunks/models_Sc3h5nta.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/modes.mdx":
      "chunks/modes_D8f3QEjg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/network.mdx":
      "chunks/network_CsbT7Cvv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/permissions.mdx":
      "chunks/permissions_DvMlWLq_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/keybinds.mdx":
      "chunks/keybinds_txOYN71J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/plugins.mdx":
      "chunks/plugins_Ud0AfGAH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/sdk.mdx":
      "chunks/sdk_BLVSlGig.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/server.mdx":
      "chunks/server_pr5f9DOx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/share.mdx":
      "chunks/share_XiIpu-fB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/skills.mdx":
      "chunks/skills_CfUOu3h2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/themes.mdx":
      "chunks/themes_CtXvqnwn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tools.mdx":
      "chunks/tools_DhotUJCd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/tui.mdx":
      "chunks/tui_CYG3zTVg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/web.mdx":
      "chunks/web_BdvQslID.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/windows-wsl.mdx":
      "chunks/windows-wsl_ZUn-Vc_d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/zen.mdx":
      "chunks/zen_C6By3BYH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/acp.mdx":
      "chunks/acp_0KiUYFwz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/agents.mdx":
      "chunks/agents_CDGHWspo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/providers.mdx":
      "chunks/providers_FUVr59tA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/rules.mdx":
      "chunks/rules_CE4SV268.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/cli.mdx":
      "chunks/cli_CEDoXuNR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/commands.mdx":
      "chunks/commands_C02Ipnqd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/troubleshooting.mdx":
      "chunks/troubleshooting_C5re69E4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/config.mdx":
      "chunks/config_B_R7geBl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/enterprise.mdx":
      "chunks/enterprise_Ct-jK9da.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/custom-tools.mdx":
      "chunks/custom-tools_CPbEZal7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/ecosystem.mdx":
      "chunks/ecosystem_BohuXPqV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/formatters.mdx":
      "chunks/formatters_yIKBoD_g.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/github.mdx":
      "chunks/github_D8Y56PKQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/ide.mdx":
      "chunks/ide_q672dma4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/gitlab.mdx":
      "chunks/gitlab_BeVDWfOa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/index.mdx":
      "chunks/index_Dq6pXoPt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/lsp.mdx":
      "chunks/lsp_B9SWUKjD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/mcp-servers.mdx":
      "chunks/mcp-servers_xTKeOLEP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/keybinds.mdx":
      "chunks/keybinds_DIA-hsD3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/models.mdx":
      "chunks/models_yWRWCaZi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/modes.mdx":
      "chunks/modes_DVF-ecFM.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/network.mdx":
      "chunks/network_DMGX2jOi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/permissions.mdx":
      "chunks/permissions_oROH55c_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/plugins.mdx":
      "chunks/plugins_Bp-qJ0AI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/providers.mdx":
      "chunks/providers_BJ85RR7y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/rules.mdx":
      "chunks/rules_B7ydI6dN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/sdk.mdx":
      "chunks/sdk_BpwcED_0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/server.mdx":
      "chunks/server_Dmw7_Wnh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/share.mdx":
      "chunks/share_BOmo6jZf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/skills.mdx":
      "chunks/skills_Cf884q4J.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/themes.mdx":
      "chunks/themes_C-lxuax8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tools.mdx":
      "chunks/tools_Cmndex2W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/troubleshooting.mdx":
      "chunks/troubleshooting_D5ZT_T3A.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/windows-wsl.mdx":
      "chunks/windows-wsl_DXf4b5JW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/web.mdx":
      "chunks/web_DCfCd7Qn.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/acp.mdx":
      "chunks/acp_Bgki2YXJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/zen.mdx":
      "chunks/zen_B3BUaXyB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/nb/tui.mdx":
      "chunks/tui_kW3GVNUE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/agents.mdx":
      "chunks/agents_Dwg4GTTH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/cli.mdx":
      "chunks/cli_DE7lzfZW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/commands.mdx":
      "chunks/commands_BNqNF2R7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/config.mdx":
      "chunks/config_BIcO7wKT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/custom-tools.mdx":
      "chunks/custom-tools_DixZWLn8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/ecosystem.mdx":
      "chunks/ecosystem_CIhdnIyA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/enterprise.mdx":
      "chunks/enterprise_Dlt0s-YR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/formatters.mdx":
      "chunks/formatters_C-hQLjYB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/github.mdx":
      "chunks/github_XvHI2kuh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/gitlab.mdx":
      "chunks/gitlab_Cf-Q1u37.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/ide.mdx":
      "chunks/ide_D2Z28TVW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/lsp.mdx":
      "chunks/lsp_BP1YIAhz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/keybinds.mdx":
      "chunks/keybinds_jJKeAgrF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/mcp-servers.mdx":
      "chunks/mcp-servers_kYQ5y6lC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/models.mdx":
      "chunks/models_DiqHdeND.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/modes.mdx":
      "chunks/modes_D5EwZXei.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/network.mdx":
      "chunks/network_l2E98Qpk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/index.mdx":
      "chunks/index_D09y6diP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/permissions.mdx":
      "chunks/permissions_B598j3EO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/plugins.mdx":
      "chunks/plugins_C3x5Htam.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/providers.mdx":
      "chunks/providers_C4yX8D_e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/rules.mdx":
      "chunks/rules_D5sM-Wyg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/sdk.mdx":
      "chunks/sdk_BReaeYLo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/server.mdx":
      "chunks/server_C1oFxK9r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/share.mdx":
      "chunks/share_BmDty8Ah.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/skills.mdx":
      "chunks/skills_iFsWcum6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/themes.mdx":
      "chunks/themes_BXUQPND2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tools.mdx":
      "chunks/tools_xkpQuho3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/web.mdx":
      "chunks/web_BfjC2Nbc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/windows-wsl.mdx":
      "chunks/windows-wsl_DI0oUWLb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/troubleshooting.mdx":
      "chunks/troubleshooting_DjliJpL_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/acp.mdx":
      "chunks/acp_4YbnleVI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/zen.mdx":
      "chunks/zen_B6OFtMRy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/agents.mdx":
      "chunks/agents_C0lN-irh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/cli.mdx":
      "chunks/cli_DnHJhitQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/tui.mdx":
      "chunks/tui_DwG14qHW.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/custom-tools.mdx":
      "chunks/custom-tools_xx_jIQTC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ecosystem.mdx":
      "chunks/ecosystem_Bh0KOg8_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/enterprise.mdx":
      "chunks/enterprise_CSe2GPoI.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/formatters.mdx":
      "chunks/formatters_DVhWRW1Q.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/github.mdx":
      "chunks/github_BgGgnZ4W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/gitlab.mdx":
      "chunks/gitlab_BHa1nHMt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ide.mdx":
      "chunks/ide_CBu1bmMa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/commands.mdx":
      "chunks/commands_x2McU8Kv.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/keybinds.mdx":
      "chunks/keybinds_BpJgumtj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/config.mdx":
      "chunks/config_CY3fQM83.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/lsp.mdx":
      "chunks/lsp_BwZ5oeoP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/index.mdx":
      "chunks/index_eWtvf1KD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/mcp-servers.mdx":
      "chunks/mcp-servers_BDQvCyDJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/models.mdx":
      "chunks/models_DzvafpmR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/modes.mdx":
      "chunks/modes_C8OeV6KQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/network.mdx":
      "chunks/network_BSk5PLVj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/permissions.mdx":
      "chunks/permissions_BMS3_6tk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/plugins.mdx":
      "chunks/plugins_DeCYms53.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/providers.mdx":
      "chunks/providers_D1Ttyx6M.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/rules.mdx":
      "chunks/rules_C0_bA56W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/sdk.mdx":
      "chunks/sdk_srrjvVVS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/server.mdx":
      "chunks/server_Dzgxa2j7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/share.mdx":
      "chunks/share_D8_ifMY8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/skills.mdx":
      "chunks/skills_C1zxIBp-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/themes.mdx":
      "chunks/themes_CBgQII5c.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/troubleshooting.mdx":
      "chunks/troubleshooting_B-X9dTsr.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tools.mdx":
      "chunks/tools_Drls4NON.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/tui.mdx":
      "chunks/tui_BDE7CQnp.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/web.mdx":
      "chunks/web_DeyHCAVE.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/windows-wsl.mdx":
      "chunks/windows-wsl_DoSJYdtk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/zen.mdx":
      "chunks/zen_DCV3gB45.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/acp.mdx":
      "chunks/acp_BIWXUJ4r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/agents.mdx":
      "chunks/agents_CB5CZBys.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/commands.mdx":
      "chunks/commands_Cy4vXEx6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/custom-tools.mdx":
      "chunks/custom-tools_D-HwEDx9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/cli.mdx":
      "chunks/cli_DxCyuvhf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/config.mdx":
      "chunks/config_CNraL7W_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/ecosystem.mdx":
      "chunks/ecosystem_CjG31KTR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/enterprise.mdx":
      "chunks/enterprise_D0hzEH1z.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/formatters.mdx":
      "chunks/formatters_Cpz_xpAH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/github.mdx":
      "chunks/github_B57l9HKs.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/gitlab.mdx":
      "chunks/gitlab_DC1bK_01.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/ide.mdx":
      "chunks/ide_COha930e.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/index.mdx":
      "chunks/index_aD88-Baz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/lsp.mdx":
      "chunks/lsp_bbseemcD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/mcp-servers.mdx":
      "chunks/mcp-servers_CdUgNMdb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/keybinds.mdx":
      "chunks/keybinds_B2BpPekD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/models.mdx":
      "chunks/models_BK41YhX3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/modes.mdx":
      "chunks/modes_DFUl1FDd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/network.mdx":
      "chunks/network_D_sW_HeS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/permissions.mdx":
      "chunks/permissions_BsRmrp-a.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/plugins.mdx":
      "chunks/plugins_CL_I0Duj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/rules.mdx":
      "chunks/rules_XhbyLp1W.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/providers.mdx":
      "chunks/providers_D0Rnrjsw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/sdk.mdx":
      "chunks/sdk_BdA2tvaz.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/server.mdx":
      "chunks/server_CaBoVdPK.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/share.mdx":
      "chunks/share_Ds-UmQ8a.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/themes.mdx":
      "chunks/themes_I1rCp04h.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/skills.mdx":
      "chunks/skills_BI9qAKFy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tools.mdx":
      "chunks/tools_BW2r8d_A.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/troubleshooting.mdx":
      "chunks/troubleshooting_iLiS86q0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/web.mdx":
      "chunks/web_C2f5vHkj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/windows-wsl.mdx":
      "chunks/windows-wsl_CSAfI0cX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/tui.mdx":
      "chunks/tui_hmVmj1Ez.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/zen.mdx":
      "chunks/zen_DTf2bj9U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/acp.mdx":
      "chunks/acp_CwYP1dDS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/agents.mdx":
      "chunks/agents_Dq475svA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/commands.mdx":
      "chunks/commands_CZ_yD5Ix.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/cli.mdx":
      "chunks/cli_DuvxIW7w.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/config.mdx":
      "chunks/config_DNxmcSld.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/custom-tools.mdx":
      "chunks/custom-tools_ERoLTNqP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/enterprise.mdx":
      "chunks/enterprise_CpqtNZ4l.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ecosystem.mdx":
      "chunks/ecosystem_BHhB1M7U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/formatters.mdx":
      "chunks/formatters_CeIGOLSB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/github.mdx":
      "chunks/github_DGDsFTPC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/gitlab.mdx":
      "chunks/gitlab_CUc6TQl-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ide.mdx":
      "chunks/ide_Cg1r2RRc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/keybinds.mdx":
      "chunks/keybinds_DdrOYY_i.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/index.mdx":
      "chunks/index_3vT9BoWT.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/lsp.mdx":
      "chunks/lsp_DHS2YkR_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/mcp-servers.mdx":
      "chunks/mcp-servers_DpDG6SEe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/models.mdx":
      "chunks/models_k4YUkCi3.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/network.mdx":
      "chunks/network_BC_QQATC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/modes.mdx":
      "chunks/modes_KerDNqMb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/permissions.mdx":
      "chunks/permissions_CfTg44gD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/plugins.mdx":
      "chunks/plugins_C34otXNJ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/rules.mdx":
      "chunks/rules_BWspWSlb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/sdk.mdx":
      "chunks/sdk_D9zEX9Q_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/server.mdx":
      "chunks/server_EnbCd6d_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/providers.mdx":
      "chunks/providers_Cx_khXTB.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/share.mdx":
      "chunks/share_Dul7xYQx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/skills.mdx":
      "chunks/skills_CZInZ7Be.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/themes.mdx":
      "chunks/themes_C2tG93QC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tools.mdx":
      "chunks/tools_DFllYN2U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/web.mdx":
      "chunks/web_BaBiygRS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/tui.mdx":
      "chunks/tui_C3D1mlCw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/acp.mdx":
      "chunks/acp_C80jUyoZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/troubleshooting.mdx":
      "chunks/troubleshooting_CwnYxsvR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/windows-wsl.mdx":
      "chunks/windows-wsl_CuvyWCB5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/agents.mdx":
      "chunks/agents_DYCEcREZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/cli.mdx":
      "chunks/cli_Dj0OMtX0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/zen.mdx":
      "chunks/zen_DnivG6OS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/commands.mdx":
      "chunks/commands_CeTc5zT5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/config.mdx":
      "chunks/config_DoE9Bswd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/custom-tools.mdx":
      "chunks/custom-tools_RzivqJEG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/ecosystem.mdx":
      "chunks/ecosystem_D8ZJ-LUt.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/enterprise.mdx":
      "chunks/enterprise_2Gb-3dmA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/formatters.mdx":
      "chunks/formatters_DpcLxDDU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/github.mdx":
      "chunks/github_BNNeqqb5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/gitlab.mdx":
      "chunks/gitlab_x_-t98-d.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/ide.mdx":
      "chunks/ide_ovuBqpU7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/index.mdx":
      "chunks/index_BMdrGzTh.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/keybinds.mdx":
      "chunks/keybinds_CgNqwdLf.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/lsp.mdx":
      "chunks/lsp_CSiQjvuX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/mcp-servers.mdx":
      "chunks/mcp-servers_CUx5Oifj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/models.mdx":
      "chunks/models_W8miXsGw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/modes.mdx":
      "chunks/modes_C1RO_QnA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/permissions.mdx":
      "chunks/permissions_NPdlBIjR.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/providers.mdx":
      "chunks/providers_ALSqCuB7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/network.mdx":
      "chunks/network_CMIqPx4T.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/rules.mdx":
      "chunks/rules_BHS8e8oG.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/plugins.mdx":
      "chunks/plugins_CRF2DlAY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/sdk.mdx":
      "chunks/sdk_rw3ECeUa.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/share.mdx":
      "chunks/share_CWYHpjZU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/skills.mdx":
      "chunks/skills_um700M3v.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/server.mdx":
      "chunks/server_CSH_UYB1.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/themes.mdx":
      "chunks/themes_Dhm06TSc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tools.mdx":
      "chunks/tools_Cf2SpL9r.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/web.mdx":
      "chunks/web_B6wWQYKd.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/windows-wsl.mdx":
      "chunks/windows-wsl_B7ugySO7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/troubleshooting.mdx":
      "chunks/troubleshooting_CNQ34WEb.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/zen.mdx":
      "chunks/zen_CYoB1las.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/cli.mdx":
      "chunks/cli_DCDbxGUl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/tui.mdx":
      "chunks/tui_C7R3ZWIx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/commands.mdx":
      "chunks/commands_Dk1SG7Oy.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/acp.mdx":
      "chunks/acp_Cqbl_zQx.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/config.mdx":
      "chunks/config_BeLY2n1I.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/custom-tools.mdx":
      "chunks/custom-tools_CIsaA8Ww.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ecosystem.mdx":
      "chunks/ecosystem_T9XRxma_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/enterprise.mdx":
      "chunks/enterprise_CfKgj7xk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/formatters.mdx":
      "chunks/formatters_CYa8McL4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/agents.mdx":
      "chunks/agents_DLGNHV2c.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/github.mdx":
      "chunks/github_ddPC8Vjl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ide.mdx":
      "chunks/ide_D6nHkkZP.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/gitlab.mdx":
      "chunks/gitlab_ykZkerkm.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/index.mdx":
      "chunks/index_CvntJjEg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/lsp.mdx":
      "chunks/lsp_DroHXIFO.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/keybinds.mdx":
      "chunks/keybinds_BRlx69c-.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/mcp-servers.mdx":
      "chunks/mcp-servers_GLj-0LBA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/models.mdx":
      "chunks/models_DMueRBEw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/modes.mdx":
      "chunks/modes_6Edm_-4p.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/network.mdx":
      "chunks/network_B54AXgbV.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/permissions.mdx":
      "chunks/permissions_Dz0fYneH.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/plugins.mdx":
      "chunks/plugins_tBqkFDWi.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/providers.mdx":
      "chunks/providers_D4jtjYVC.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/rules.mdx":
      "chunks/rules_D97SsnFe.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/sdk.mdx":
      "chunks/sdk_BDQPIOJk.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/server.mdx":
      "chunks/server_Djsz7j8X.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/share.mdx":
      "chunks/share_D6ZJsIY2.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/skills.mdx":
      "chunks/skills_BIp3eozS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/themes.mdx":
      "chunks/themes_CjpFdXMc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tools.mdx":
      "chunks/tools_Cd3uYau5.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/windows-wsl.mdx":
      "chunks/windows-wsl_D7rBEIOS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/web.mdx":
      "chunks/web_TzEcWheD.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/zen.mdx":
      "chunks/zen_yqhyLK9N.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/acp.mdx":
      "chunks/acp_Bj3vymPc.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/troubleshooting.mdx":
      "chunks/troubleshooting_CsvlvouL.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/agents.mdx":
      "chunks/agents_kvMEhL5_.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/commands.mdx":
      "chunks/commands_bTxrgY2X.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/config.mdx":
      "chunks/config_C5e0XLRZ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/tui.mdx":
      "chunks/tui_BTyoqyJQ.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/custom-tools.mdx":
      "chunks/custom-tools_kuGE8OyY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx":
      "chunks/cli_t6wMcas8.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/enterprise.mdx":
      "chunks/enterprise_DPebYrPl.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/formatters.mdx":
      "chunks/formatters_uu6CpWSN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/github.mdx":
      "chunks/github_C9ywtXl0.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/gitlab.mdx":
      "chunks/gitlab_CM6gV6Jo.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ide.mdx":
      "chunks/ide_DkIT-gyq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/index.mdx":
      "chunks/index_vHaOVho4.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ecosystem.mdx":
      "chunks/ecosystem_Dv2E7rXA.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/lsp.mdx":
      "chunks/lsp_BmD9qNSU.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/mcp-servers.mdx":
      "chunks/mcp-servers_J7bvT41f.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/models.mdx":
      "chunks/models_Bw1tQb83.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/keybinds.mdx":
      "chunks/keybinds_qRidTxI6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/modes.mdx":
      "chunks/modes_Cl7EVl1G.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/network.mdx":
      "chunks/network_BH_Fvm-9.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/plugins.mdx":
      "chunks/plugins_WZ4M3Vvj.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/permissions.mdx":
      "chunks/permissions_C4pQ2zeg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/providers.mdx":
      "chunks/providers_BcPzHSrw.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/rules.mdx":
      "chunks/rules_C51lnBUN.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/sdk.mdx":
      "chunks/sdk_B8LZDGmX.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/server.mdx":
      "chunks/server_-s1CCUqu.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/share.mdx":
      "chunks/share_NJtkZjyS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/skills.mdx":
      "chunks/skills_BJFr_e5V.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/themes.mdx":
      "chunks/themes_BDSTaERg.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tools.mdx":
      "chunks/tools_B2fW5lPq.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/web.mdx":
      "chunks/web_DaVgWe_Y.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/windows-wsl.mdx":
      "chunks/windows-wsl_Bb5t5WuY.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/zen.mdx":
      "chunks/zen_UqnihkRF.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/troubleshooting.mdx":
      "chunks/troubleshooting_DANBitO6.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/tui.mdx":
      "chunks/tui_DSpOH9mS.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/changelog.mdx":
      "chunks/changelog_Cx2IWxEE.mjs",
    "\u0000@astrojs-manifest": "manifest_axjOK_9U.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/astro-expressive-code@0.41.6+d4a9ca0ffe30da47/node_modules/astro-expressive-code/dist/index.js":
      "chunks/index_DxMzfxvF.mjs",
    "\u0000virtual:astro-expressive-code/preprocess-config": "chunks/preprocess-config_Zeos-AU7.mjs",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content.config.ts":
      "chunks/content.config_xsswYDs9.mjs",
    "@astrojs/solid-js/client.js": "_astro/client.0PCFb84_.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Page.astro?astro&type=script&index=0&lang.ts":
      "_astro/Page.astro_astro_type_script_index_0_lang.BHQeG8Vj.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/user-components/Tabs.astro?astro&type=script&index=0&lang.ts":
      "_astro/Tabs.astro_astro_type_script_index_0_lang._fLr8MwR.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/MobileMenuToggle.astro?astro&type=script&index=0&lang.ts":
      "_astro/MobileMenuToggle.astro_astro_type_script_index_0_lang.CsfLbggW.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/LanguageSelect.astro?astro&type=script&index=0&lang.ts":
      "_astro/LanguageSelect.astro_astro_type_script_index_0_lang.Ce-i7NLC.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/ThemeSelect.astro?astro&type=script&index=0&lang.ts":
      "_astro/ThemeSelect.astro_astro_type_script_index_0_lang.Znk7Hhgg.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/MobileTableOfContents.astro?astro&type=script&index=0&lang.ts":
      "_astro/MobileTableOfContents.astro_astro_type_script_index_0_lang.C181hMzK.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/shiki@3.20.0/node_modules/shiki/dist/wasm.mjs":
      "_astro/wasm.CG6Dc4jp.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/abap.mjs":
      "_astro/abap.BdImnpbu.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/actionscript-3.mjs":
      "_astro/actionscript-3.CfeIJUat.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ada.mjs":
      "_astro/ada.bCR0ucgS.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/apache.mjs":
      "_astro/apache.Pmp26Uib.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/apex.mjs":
      "_astro/apex.DDbsPZ6N.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/apl.mjs":
      "_astro/apl.k_NP5JKR.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/applescript.mjs":
      "_astro/applescript.Co6uUVPk.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ara.mjs":
      "_astro/ara.BRHolxvo.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/asciidoc.mjs":
      "_astro/asciidoc.Dv7Oe6Be.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/asm.mjs":
      "_astro/asm.D_Q5rh1f.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/astro.mjs":
      "_astro/astro.BykyiR6i.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/awk.mjs":
      "_astro/awk.DMzUqQB5.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ballerina.mjs":
      "_astro/ballerina.BFfxhgS-.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/bat.mjs":
      "_astro/bat.BkioyH1T.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/beancount.mjs":
      "_astro/beancount.k_qm7-4y.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/berry.mjs":
      "_astro/berry.uYugtg8r.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/bibtex.mjs":
      "_astro/bibtex.CHM0blh-.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/bicep.mjs":
      "_astro/bicep.Bmn6On1c.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/html.mjs":
      "_astro/html.Ba7gwcmN.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/javascript.mjs":
      "_astro/javascript.wDzz0qaB.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/css.mjs":
      "_astro/css.DPfMkruS.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/scss.mjs":
      "_astro/scss.Dd55VJtY.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/xml.mjs":
      "_astro/xml.CzC_-KeP.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/json.mjs":
      "_astro/json.Cp-IABpG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/java.mjs":
      "_astro/java.CylS5w8V.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/typescript.mjs":
      "_astro/typescript.BPQ3VLAy.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/postcss.mjs":
      "_astro/postcss.CXtECtnM.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/tsx.mjs":
      "_astro/tsx.COt5Ahok.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/blade.mjs":
      "_astro/blade.CEc3Zo6V.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/html-derivative.mjs":
      "_astro/html-derivative.BKW2YC-x.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/sql.mjs":
      "_astro/sql.BLtJtn59.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/bsl.mjs":
      "_astro/bsl.CQ-hWmPL.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/sdbl.mjs":
      "_astro/sdbl.DVxCFoDh.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/c.mjs":
      "_astro/c.BIGW1oBm.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cadence.mjs":
      "_astro/cadence.Bv_4Rxtq.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cairo.mjs":
      "_astro/cairo.B2qsAHtI.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/python.mjs":
      "_astro/python.B6aJPvgy.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/clarity.mjs":
      "_astro/clarity.D53aC0YG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/clojure.mjs":
      "_astro/clojure.P80f7IUj.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cmake.mjs":
      "_astro/cmake.D1j8_8rp.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cobol.mjs":
      "_astro/cobol.iJnzY4NG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/codeowners.mjs":
      "_astro/codeowners.Bp6g37R7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/codeql.mjs":
      "_astro/codeql.DsOJ9woJ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/coffee.mjs":
      "_astro/coffee.DKmKaF_c.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/common-lisp.mjs":
      "_astro/common-lisp.Cg-RD9OK.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/coq.mjs":
      "_astro/coq.DkFqJrB1.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/regexp.mjs":
      "_astro/regexp.CDVJQ6XC.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/glsl.mjs":
      "_astro/glsl.DyqZbVRN.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/crystal.mjs":
      "_astro/crystal.DKofdfDr.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/shellscript.mjs":
      "_astro/shellscript.Yzrsuije.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/csharp.mjs":
      "_astro/csharp.K5feNrxe.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/csv.mjs":
      "_astro/csv.fuZLfV_i.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cue.mjs":
      "_astro/cue.D82EKSYY.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cypher.mjs":
      "_astro/cypher.COkxafJQ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/d.mjs":
      "_astro/d.85-TOEBH.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/dart.mjs":
      "_astro/dart.CF10PKvl.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/dax.mjs":
      "_astro/dax.CEL-wOlO.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/desktop.mjs":
      "_astro/desktop.BmXAJ9_W.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/diff.mjs":
      "_astro/diff.D97Zzqfu.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/docker.mjs":
      "_astro/docker.BcOcwvcX.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/dotenv.mjs":
      "_astro/dotenv.Da5cRb03.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/dream-maker.mjs":
      "_astro/dream-maker.BtqSS_iP.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/edge.mjs":
      "_astro/edge.MkbK9FOR.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/elixir.mjs":
      "_astro/elixir.6BSQlbSC.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/elm.mjs":
      "_astro/elm.DbGDORWF.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/emacs-lisp.mjs":
      "_astro/emacs-lisp.C9XAeP06.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/erb.mjs":
      "_astro/erb.WkhW7KOa.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ruby.mjs":
      "_astro/ruby.B0gjitPT.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/haml.mjs":
      "_astro/haml.DB8FAn2y.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/graphql.mjs":
      "_astro/graphql.BG5Wfmbq.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/lua.mjs":
      "_astro/lua.L2A8iFU9.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/yaml.mjs":
      "_astro/yaml.Buea-lGh.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jsx.mjs":
      "_astro/jsx.g9-lgVsj.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/erlang.mjs":
      "_astro/erlang.ImAjNfjq.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/markdown.mjs":
      "_astro/markdown.Cvjx9yec.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fennel.mjs":
      "_astro/fennel.BYunw83y.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fish.mjs":
      "_astro/fish.BvzEVeQv.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fluent.mjs":
      "_astro/fluent.C4IJs8-o.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fortran-fixed-form.mjs":
      "_astro/fortran-fixed-form.C0Uj2a1n.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fortran-free-form.mjs":
      "_astro/fortran-free-form.D22FLkUw.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/fsharp.mjs":
      "_astro/fsharp.DtkzXLn2.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gdresource.mjs":
      "_astro/gdresource.BFzsGA9q.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gdshader.mjs":
      "_astro/gdshader.DkwncUOv.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gdscript.mjs":
      "_astro/gdscript.DTMYz4Jt.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/genie.mjs":
      "_astro/genie.D0YGMca9.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gherkin.mjs":
      "_astro/gherkin.DyxjwDmM.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/git-commit.mjs":
      "_astro/git-commit.ZvBw70vl.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/git-rebase.mjs":
      "_astro/git-rebase.CgB5NAD0.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gleam.mjs":
      "_astro/gleam.BspZqrRM.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/glimmer-js.mjs":
      "_astro/glimmer-js.cFcAouY8.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/glimmer-ts.mjs":
      "_astro/glimmer-ts.CprFVBm7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/gnuplot.mjs":
      "_astro/gnuplot.DdkO51Og.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/go.mjs":
      "_astro/go.Dn2_MT6a.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/groovy.mjs":
      "_astro/groovy.gcz8RCvz.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hack.mjs":
      "_astro/hack.BldGDK54.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/handlebars.mjs":
      "_astro/handlebars.CqcQwGw0.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/haskell.mjs":
      "_astro/haskell.Df6bDoY_.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/haxe.mjs":
      "_astro/haxe.CzTSHFRz.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hcl.mjs":
      "_astro/hcl.BWvSN4gD.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hjson.mjs":
      "_astro/hjson.D5-asLiD.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hlsl.mjs":
      "_astro/hlsl.D3lLCCz7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/http.mjs":
      "_astro/http.CF3aaTnG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hurl.mjs":
      "_astro/hurl.xqe7P31G.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hxml.mjs":
      "_astro/hxml.D1AJYkwz.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/hy.mjs":
      "_astro/hy.DFXneXwc.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/imba.mjs":
      "_astro/imba.DGztddWO.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ini.mjs":
      "_astro/ini.BEwlwnbL.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jison.mjs":
      "_astro/jison.DVLNWbJO.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/json5.mjs":
      "_astro/json5.C9tS-k6U.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jsonc.mjs":
      "_astro/jsonc.Des-eS-w.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jsonl.mjs":
      "_astro/jsonl.DcaNXYhu.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jsonnet.mjs":
      "_astro/jsonnet.DFQXde-d.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jssm.mjs":
      "_astro/jssm.C2t-YnRu.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/julia.mjs":
      "_astro/julia._S5dWHQQ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/r.mjs":
      "_astro/r.DiinP2Uv.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/kdl.mjs":
      "_astro/kdl.DV7GczEv.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/kotlin.mjs":
      "_astro/kotlin.BdnUsdx6.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/kusto.mjs":
      "_astro/kusto.BvAqAH-y.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/latex.mjs":
      "_astro/latex.Bl8WQsvx.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/tex.mjs":
      "_astro/tex.BmUAfLkY.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/lean.mjs":
      "_astro/lean.Bc6EcWN3.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/less.mjs":
      "_astro/less.B1dDrJ26.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/liquid.mjs":
      "_astro/liquid.BlU4_Ni7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/llvm.mjs":
      "_astro/llvm.BtvRca6l.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/log.mjs":
      "_astro/log.2UxHyX5q.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/logo.mjs":
      "_astro/logo.BtOb2qkB.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/luau.mjs":
      "_astro/luau.CXu1NL6O.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/make.mjs":
      "_astro/make.CHLpvVh8.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/marko.mjs":
      "_astro/marko.D6EYFsJG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/matlab.mjs":
      "_astro/matlab.D7o27uSR.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/mdc.mjs":
      "_astro/mdc.Cjsp0TmC.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/mdx.mjs":
      "_astro/mdx.Cmh6b_Ma.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/mermaid.mjs":
      "_astro/mermaid.DKYwYmdq.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/mipsasm.mjs":
      "_astro/mipsasm.CKIfxQSi.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/mojo.mjs":
      "_astro/mojo.1DNp92w6.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/move.mjs":
      "_astro/move.Bu9oaDYs.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/narrat.mjs":
      "_astro/narrat.DRg8JJMk.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/nextflow.mjs":
      "_astro/nextflow.BrzmwbiE.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/nginx.mjs":
      "_astro/nginx.LXkp3hKR.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/nim.mjs":
      "_astro/nim.Cr2imQLJ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/nushell.mjs":
      "_astro/nushell.C-sUppwS.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/objective-c.mjs":
      "_astro/objective-c.DXmwc3jG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/objective-cpp.mjs":
      "_astro/objective-cpp.CLxacb5B.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ocaml.mjs":
      "_astro/ocaml.C0hk2d4L.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/openscad.mjs":
      "_astro/openscad.C4EeE6gA.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/pascal.mjs":
      "_astro/pascal.D93ZcfNL.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/perl.mjs":
      "_astro/perl.-byXnlwh.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/php.mjs":
      "_astro/php.9KF3_YNX.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/pkl.mjs":
      "_astro/pkl.u5AG7uiY.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/plsql.mjs":
      "_astro/plsql.ChMvpjG-.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/po.mjs":
      "_astro/po.BTJTHyun.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/polar.mjs":
      "_astro/polar.C0HS_06l.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/powerquery.mjs":
      "_astro/powerquery.CEu0bR-o.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/powershell.mjs":
      "_astro/powershell.Dpen1YoG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/prisma.mjs":
      "_astro/prisma.Dd19v3D-.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/prolog.mjs":
      "_astro/prolog.CbFg5uaA.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/proto.mjs":
      "_astro/proto.DyJlTyXw.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/pug.mjs":
      "_astro/pug.Bugb9Bl6.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/puppet.mjs":
      "_astro/puppet.BMWR74SV.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/purescript.mjs":
      "_astro/purescript.CklMAg4u.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/qml.mjs":
      "_astro/qml.Bn7K45KN.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/qmldir.mjs":
      "_astro/qmldir.C8lEn-DE.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/qss.mjs":
      "_astro/qss.IeuSbFQv.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/racket.mjs":
      "_astro/racket.BqYA7rlc.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/raku.mjs":
      "_astro/raku.DXvB9xmW.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/razor.mjs":
      "_astro/razor.BN1najNr.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/reg.mjs":
      "_astro/reg.C-SQnVFl.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/rel.mjs":
      "_astro/rel.C3B-1QV4.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/riscv.mjs":
      "_astro/riscv.BM1_JUlF.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/rosmsg.mjs":
      "_astro/rosmsg.BJDFO7_C.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/rst.mjs":
      "_astro/rst.D10yH3Ta.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/rust.mjs":
      "_astro/rust.B1yitclQ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/sas.mjs":
      "_astro/sas.DdhshEKr.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/sass.mjs":
      "_astro/sass.Cj5Yp3dK.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/scala.mjs":
      "_astro/scala.C151Ov-r.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/scheme.mjs":
      "_astro/scheme.C98Dy4si.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/shaderlab.mjs":
      "_astro/shaderlab.yPvxg9J0.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/shellsession.mjs":
      "_astro/shellsession.caH0oxFO.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/smalltalk.mjs":
      "_astro/smalltalk.BERRCDM3.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/solidity.mjs":
      "_astro/solidity.rGO070M0.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/soy.mjs":
      "_astro/soy.B9N8wvJ7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/sparql.mjs":
      "_astro/sparql.DjVdNVty.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/turtle.mjs":
      "_astro/turtle.BsS91CYL.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/splunk.mjs":
      "_astro/splunk.BtCnVYZw.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ssh-config.mjs":
      "_astro/ssh-config._ykCGR6B.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/stata.mjs":
      "_astro/stata.CHb5Z2Qa.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/stylus.mjs":
      "_astro/stylus.BEDo0Tqx.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/svelte.mjs":
      "_astro/svelte.CBZA061O.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/swift.mjs":
      "_astro/swift.Dg5xB15N.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/system-verilog.mjs":
      "_astro/system-verilog.CnnmHF94.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/systemd.mjs":
      "_astro/systemd.4A_iFExJ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/talonscript.mjs":
      "_astro/talonscript.CkByrt1z.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/tasl.mjs":
      "_astro/tasl.QIJgUcNo.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/tcl.mjs":
      "_astro/tcl.dwOrl1Do.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/templ.mjs":
      "_astro/templ.2dDLW-e5.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/terraform.mjs":
      "_astro/terraform.BETggiCN.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/toml.mjs":
      "_astro/toml.vGWfd6FD.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/tsv.mjs":
      "_astro/tsv.B_m7g4N7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/twig.mjs":
      "_astro/twig.Bk2oAOvA.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/typespec.mjs":
      "_astro/typespec.BGHnOYBU.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/typst.mjs":
      "_astro/typst.DHCkPAjA.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/v.mjs":
      "_astro/v.BcVCzyr7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vala.mjs":
      "_astro/vala.CsfeWuGM.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vb.mjs":
      "_astro/vb.D17OF-Vu.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/verilog.mjs":
      "_astro/verilog.BQ8w6xss.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vhdl.mjs":
      "_astro/vhdl.CeAyd5Ju.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/viml.mjs":
      "_astro/viml.CJc9bBzg.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vue-html.mjs":
      "_astro/vue-html.a0q_3Za-.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vue-vine.mjs":
      "_astro/vue-vine.CrBrnmZm.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vyper.mjs":
      "_astro/vyper.CDx5xZoG.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wasm.mjs":
      "_astro/wasm.MzD3tlZU.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wenyan.mjs":
      "_astro/wenyan.BV7otONQ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wgsl.mjs":
      "_astro/wgsl.Dx-B1_4e.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wikitext.mjs":
      "_astro/wikitext.BhOHFoWU.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wit.mjs":
      "_astro/wit.5i3qLPDT.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/wolfram.mjs":
      "_astro/wolfram.lXgVvXCa.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/xsl.mjs":
      "_astro/xsl.BYxnvhpS.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/zenscript.mjs":
      "_astro/zenscript.DVFEvuxE.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/zig.mjs":
      "_astro/zig.VOosw3JB.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+themes@3.20.0/node_modules/@shikijs/themes/dist/github-dark.mjs":
      "_astro/github-dark.DHJKELXO.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+themes@3.20.0/node_modules/@shikijs/themes/dist/github-light.mjs":
      "_astro/github-light.DAi9KRSo.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@pagefind+default-ui@1.4.0/node_modules/@pagefind/default-ui/npm_dist/mjs/ui-core.mjs":
      "_astro/ui-core.5vfW5kUq.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Search.astro?astro&type=script&index=0&lang.ts":
      "_astro/Search.astro_astro_type_script_index_0_lang.ZeYNpLV4.js",
    "astro:scripts/page.js": "_astro/page.7qqag-5g.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/cpp.mjs":
      "_astro/cpp.wd-Fnpl7.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/jinja.mjs":
      "_astro/jinja.FHi28KpQ.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/nix.mjs":
      "_astro/nix.c8nO5XWb.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/angular-ts.mjs":
      "_astro/angular-ts.BP95hQjW.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/vue.mjs":
      "_astro/vue.2kJ8ky7n.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@shikijs+langs@3.20.0/node_modules/@shikijs/langs/dist/ts-tags.mjs":
      "_astro/ts-tags.BxRApIEP.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/components/Share.tsx":
      "_astro/Share.BdyFfoKI.js",
    "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/TableOfContents.astro?astro&type=script&index=0&lang.ts":
      "_astro/TableOfContents.astro_astro_type_script_index_0_lang.CKWWgpjV.js",
    "astro:scripts/before-hydration.js": "",
  },
  inlinedScripts: [
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/Page.astro?astro&type=script&index=0&lang.ts",
      'const a=document.getElementById("starlight__sidebar"),n=a?.querySelector("sl-sidebar-state-persist"),o="sl-sidebar-state",i=()=>{let t=[];const e=n?.dataset.hash||"";try{const s=sessionStorage.getItem(o),r=JSON.parse(s||"{}");Array.isArray(r.open)&&r.hash===e&&(t=r.open)}catch{}return{hash:e,open:t,scroll:a?.scrollTop||0}},c=t=>{try{sessionStorage.setItem(o,JSON.stringify(t))}catch{}},d=()=>c(i()),l=(t,e)=>{const s=i();s.open[e]=t,c(s)};n?.addEventListener("click",t=>{if(!(t.target instanceof Element))return;const e=t.target.closest("summary")?.closest("details");if(!e)return;const s=e.querySelector("sl-sidebar-restore"),r=parseInt(s?.dataset.index||"");isNaN(r)||l(!e.open,r)});addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&d()});addEventListener("pageHide",d);',
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/user-components/Tabs.astro?astro&type=script&index=0&lang.ts",
      'class r extends HTMLElement{static#e=new Map;#t;#n="starlight-synced-tabs__";constructor(){super();const t=this.querySelector(\'[role="tablist"]\');if(this.tabs=[...t.querySelectorAll(\'[role="tab"]\')],this.panels=[...this.querySelectorAll(\':scope > [role="tabpanel"]\')],this.#t=this.dataset.syncKey,this.#t){const i=r.#e.get(this.#t)??[];i.push(this),r.#e.set(this.#t,i)}this.tabs.forEach((i,c)=>{i.addEventListener("click",e=>{e.preventDefault();const n=t.querySelector(\'[aria-selected="true"]\');e.currentTarget!==n&&this.switchTab(e.currentTarget,c)}),i.addEventListener("keydown",e=>{const n=this.tabs.indexOf(e.currentTarget),s=e.key==="ArrowLeft"?n-1:e.key==="ArrowRight"?n+1:e.key==="Home"?0:e.key==="End"?this.tabs.length-1:null;s!==null&&this.tabs[s]&&(e.preventDefault(),this.switchTab(this.tabs[s],s))})})}switchTab(t,i,c=!0){if(!t)return;const e=c?this.getBoundingClientRect().top:0;this.tabs.forEach(s=>{s.setAttribute("aria-selected","false"),s.setAttribute("tabindex","-1")}),this.panels.forEach(s=>{s.hidden=!0});const n=this.panels[i];n&&(n.hidden=!1),t.removeAttribute("tabindex"),t.setAttribute("aria-selected","true"),c&&(t.focus(),r.#r(this,t),window.scrollTo({top:window.scrollY+(this.getBoundingClientRect().top-e),behavior:"instant"}))}#i(t){!this.#t||typeof localStorage>"u"||localStorage.setItem(this.#n+this.#t,t)}static#r(t,i){const c=t.#t,e=r.#s(i);if(!c||!e)return;const n=r.#e.get(c);if(n){for(const s of n){if(s===t)continue;const a=s.tabs.findIndex(o=>r.#s(o)===e);a!==-1&&s.switchTab(s.tabs[a],a,!1)}t.#i(e)}}static#s(t){return t.textContent?.trim()}}customElements.define("starlight-tabs",r);',
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/MobileMenuToggle.astro?astro&type=script&index=0&lang.ts",
      'class s extends HTMLElement{constructor(){super(),this.btn=this.querySelector("button"),this.btn.addEventListener("click",()=>this.toggleExpanded());const t=this.closest("nav");t&&t.addEventListener("keyup",e=>this.closeOnEscape(e))}setExpanded(t){this.setAttribute("aria-expanded",String(t)),document.body.toggleAttribute("data-mobile-menu-expanded",t)}toggleExpanded(){this.setExpanded(this.getAttribute("aria-expanded")!=="true")}closeOnEscape(t){t.code==="Escape"&&(this.setExpanded(!1),this.btn.focus())}}customElements.define("starlight-menu-button",s);',
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/LanguageSelect.astro?astro&type=script&index=0&lang.ts",
      'class s extends HTMLElement{constructor(){super();const e=this.querySelector("select");e&&(e.addEventListener("change",t=>{t.currentTarget instanceof HTMLSelectElement&&(window.location.pathname=t.currentTarget.value)}),window.addEventListener("pageshow",t=>{if(!t.persisted)return;const n=e.querySelector("option[selected]")?.index;n!==e.selectedIndex&&(e.selectedIndex=n??0)}))}}customElements.define("starlight-lang-select",s);',
    ],
    [
      "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/components/ThemeSelect.astro?astro&type=script&index=0&lang.ts",
      'const r="starlight-theme",o=e=>e==="auto"||e==="dark"||e==="light"?e:"auto",c=()=>o(typeof localStorage<"u"&&localStorage.getItem(r));function n(e){typeof localStorage<"u"&&localStorage.setItem(r,e==="light"||e==="dark"?e:"")}const l=()=>matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";function t(e){StarlightThemeProvider.updatePickers(e),document.documentElement.dataset.theme=e==="auto"?l():e,n(e)}matchMedia("(prefers-color-scheme: light)").addEventListener("change",()=>{c()==="auto"&&t("auto")});class s extends HTMLElement{constructor(){super(),t(c()),this.querySelector("select")?.addEventListener("change",a=>{a.currentTarget instanceof HTMLSelectElement&&t(o(a.currentTarget.value))})}}customElements.define("starlight-theme-select",s);',
    ],
  ],
  assets: [
    "/_astro/ec.4c0k7.css",
    "/_astro/ec.0vx5m.js",
    "/_astro/logo-light.JW7yDsY9.svg",
    "/_astro/logo-dark.DKnNIUK_.svg",
    "/_astro/web-homepage-new-session.BB1mEdgo.png",
    "/_astro/web-homepage-active-session.BbK4Ph6e.png",
    "/_astro/web-homepage-see-servers.BpCOef2l.png",
    "/_astro/screenshot.BdITzcNa.png",
    "/_astro/print.DNXP8c50.css",
    "/_astro/_id_.BzgDuL50.css",
    "/apple-touch-icon-v3.png",
    "/apple-touch-icon.png",
    "/favicon-96x96-v3.png",
    "/favicon-96x96.png",
    "/favicon-v3.ico",
    "/favicon-v3.svg",
    "/favicon.ico",
    "/favicon.svg",
    "/install",
    "/robots.txt",
    "/site.webmanifest",
    "/social-share-zen.png",
    "/social-share.png",
    "/theme.json",
    "/web-app-manifest-192x192.png",
    "/web-app-manifest-512x512.png",
    "/_astro/MobileTableOfContents.astro_astro_type_script_index_0_lang.C181hMzK.js",
    "/_astro/Search.astro_astro_type_script_index_0_lang.ZeYNpLV4.js",
    "/_astro/Share.BdyFfoKI.js",
    "/_astro/Share.DI-MEA2z.css",
    "/_astro/TableOfContents.astro_astro_type_script_index_0_lang.CKWWgpjV.js",
    "/_astro/abap.BdImnpbu.js",
    "/_astro/actionscript-3.CfeIJUat.js",
    "/_astro/ada.bCR0ucgS.js",
    "/_astro/angular-html.CMnObbHM.js",
    "/_astro/angular-ts.BP95hQjW.js",
    "/_astro/apache.Pmp26Uib.js",
    "/_astro/apex.DDbsPZ6N.js",
    "/_astro/apl.k_NP5JKR.js",
    "/_astro/applescript.Co6uUVPk.js",
    "/_astro/ara.BRHolxvo.js",
    "/_astro/asciidoc.Dv7Oe6Be.js",
    "/_astro/asm.D_Q5rh1f.js",
    "/_astro/astro.BykyiR6i.js",
    "/_astro/awk.DMzUqQB5.js",
    "/_astro/ballerina.BFfxhgS-.js",
    "/_astro/bat.BkioyH1T.js",
    "/_astro/beancount.k_qm7-4y.js",
    "/_astro/berry.uYugtg8r.js",
    "/_astro/bibtex.CHM0blh-.js",
    "/_astro/bicep.Bmn6On1c.js",
    "/_astro/blade.CEc3Zo6V.js",
    "/_astro/bsl.CQ-hWmPL.js",
    "/_astro/c.BIGW1oBm.js",
    "/_astro/cadence.Bv_4Rxtq.js",
    "/_astro/cairo.B2qsAHtI.js",
    "/_astro/clarity.D53aC0YG.js",
    "/_astro/client.0PCFb84_.js",
    "/_astro/clojure.P80f7IUj.js",
    "/_astro/cmake.D1j8_8rp.js",
    "/_astro/cobol.iJnzY4NG.js",
    "/_astro/codeowners.Bp6g37R7.js",
    "/_astro/codeql.DsOJ9woJ.js",
    "/_astro/coffee.DKmKaF_c.js",
    "/_astro/common-lisp.Cg-RD9OK.js",
    "/_astro/coq.DkFqJrB1.js",
    "/_astro/cpp.wd-Fnpl7.js",
    "/_astro/crystal.DKofdfDr.js",
    "/_astro/csharp.K5feNrxe.js",
    "/_astro/css.DPfMkruS.js",
    "/_astro/csv.fuZLfV_i.js",
    "/_astro/cue.D82EKSYY.js",
    "/_astro/cypher.COkxafJQ.js",
    "/_astro/d.85-TOEBH.js",
    "/_astro/dart.CF10PKvl.js",
    "/_astro/dax.CEL-wOlO.js",
    "/_astro/desktop.BmXAJ9_W.js",
    "/_astro/diff.D97Zzqfu.js",
    "/_astro/docker.BcOcwvcX.js",
    "/_astro/dotenv.Da5cRb03.js",
    "/_astro/dream-maker.BtqSS_iP.js",
    "/_astro/edge.MkbK9FOR.js",
    "/_astro/elixir.6BSQlbSC.js",
    "/_astro/elm.DbGDORWF.js",
    "/_astro/emacs-lisp.C9XAeP06.js",
    "/_astro/erb.WkhW7KOa.js",
    "/_astro/erlang.ImAjNfjq.js",
    "/_astro/fennel.BYunw83y.js",
    "/_astro/fish.BvzEVeQv.js",
    "/_astro/fluent.C4IJs8-o.js",
    "/_astro/fortran-fixed-form.C0Uj2a1n.js",
    "/_astro/fortran-free-form.D22FLkUw.js",
    "/_astro/fsharp.DtkzXLn2.js",
    "/_astro/gdresource.BFzsGA9q.js",
    "/_astro/gdscript.DTMYz4Jt.js",
    "/_astro/gdshader.DkwncUOv.js",
    "/_astro/genie.D0YGMca9.js",
    "/_astro/gherkin.DyxjwDmM.js",
    "/_astro/git-commit.ZvBw70vl.js",
    "/_astro/git-rebase.CgB5NAD0.js",
    "/_astro/github-dark.DHJKELXO.js",
    "/_astro/github-light.DAi9KRSo.js",
    "/_astro/gleam.BspZqrRM.js",
    "/_astro/glimmer-js.cFcAouY8.js",
    "/_astro/glimmer-ts.CprFVBm7.js",
    "/_astro/glsl.DyqZbVRN.js",
    "/_astro/gnuplot.DdkO51Og.js",
    "/_astro/go.Dn2_MT6a.js",
    "/_astro/graphql.BG5Wfmbq.js",
    "/_astro/groovy.gcz8RCvz.js",
    "/_astro/hack.BldGDK54.js",
    "/_astro/haml.DB8FAn2y.js",
    "/_astro/handlebars.CqcQwGw0.js",
    "/_astro/haskell.Df6bDoY_.js",
    "/_astro/haxe.CzTSHFRz.js",
    "/_astro/hcl.BWvSN4gD.js",
    "/_astro/hjson.D5-asLiD.js",
    "/_astro/hlsl.D3lLCCz7.js",
    "/_astro/html-derivative.BKW2YC-x.js",
    "/_astro/html.Ba7gwcmN.js",
    "/_astro/http.CF3aaTnG.js",
    "/_astro/hurl.xqe7P31G.js",
    "/_astro/hxml.D1AJYkwz.js",
    "/_astro/hy.DFXneXwc.js",
    "/_astro/imba.DGztddWO.js",
    "/_astro/ini.BEwlwnbL.js",
    "/_astro/java.CylS5w8V.js",
    "/_astro/javascript.wDzz0qaB.js",
    "/_astro/jinja.FHi28KpQ.js",
    "/_astro/jison.DVLNWbJO.js",
    "/_astro/json.Cp-IABpG.js",
    "/_astro/json5.C9tS-k6U.js",
    "/_astro/jsonc.Des-eS-w.js",
    "/_astro/jsonl.DcaNXYhu.js",
    "/_astro/jsonnet.DFQXde-d.js",
    "/_astro/jssm.C2t-YnRu.js",
    "/_astro/jsx.g9-lgVsj.js",
    "/_astro/julia._S5dWHQQ.js",
    "/_astro/kdl.DV7GczEv.js",
    "/_astro/kotlin.BdnUsdx6.js",
    "/_astro/kusto.BvAqAH-y.js",
    "/_astro/latex.Bl8WQsvx.js",
    "/_astro/lean.Bc6EcWN3.js",
    "/_astro/less.B1dDrJ26.js",
    "/_astro/liquid.BlU4_Ni7.js",
    "/_astro/llvm.BtvRca6l.js",
    "/_astro/log.2UxHyX5q.js",
    "/_astro/logo.BtOb2qkB.js",
    "/_astro/lua.L2A8iFU9.js",
    "/_astro/luau.CXu1NL6O.js",
    "/_astro/make.CHLpvVh8.js",
    "/_astro/markdown.Cvjx9yec.js",
    "/_astro/marko.D6EYFsJG.js",
    "/_astro/matlab.D7o27uSR.js",
    "/_astro/mdc.Cjsp0TmC.js",
    "/_astro/mdx.Cmh6b_Ma.js",
    "/_astro/mermaid.DKYwYmdq.js",
    "/_astro/mipsasm.CKIfxQSi.js",
    "/_astro/mojo.1DNp92w6.js",
    "/_astro/move.Bu9oaDYs.js",
    "/_astro/narrat.DRg8JJMk.js",
    "/_astro/nextflow.BrzmwbiE.js",
    "/_astro/nginx.LXkp3hKR.js",
    "/_astro/nim.Cr2imQLJ.js",
    "/_astro/nix.c8nO5XWb.js",
    "/_astro/nushell.C-sUppwS.js",
    "/_astro/objective-c.DXmwc3jG.js",
    "/_astro/objective-cpp.CLxacb5B.js",
    "/_astro/ocaml.C0hk2d4L.js",
    "/_astro/openscad.C4EeE6gA.js",
    "/_astro/page.7qqag-5g.js",
    "/_astro/pascal.D93ZcfNL.js",
    "/_astro/perl.-byXnlwh.js",
    "/_astro/php.9KF3_YNX.js",
    "/_astro/pkl.u5AG7uiY.js",
    "/_astro/plsql.ChMvpjG-.js",
    "/_astro/po.BTJTHyun.js",
    "/_astro/polar.C0HS_06l.js",
    "/_astro/postcss.CXtECtnM.js",
    "/_astro/powerquery.CEu0bR-o.js",
    "/_astro/powershell.Dpen1YoG.js",
    "/_astro/preload-helper.BlTxHScW.js",
    "/_astro/prisma.Dd19v3D-.js",
    "/_astro/prolog.CbFg5uaA.js",
    "/_astro/proto.DyJlTyXw.js",
    "/_astro/pug.Bugb9Bl6.js",
    "/_astro/puppet.BMWR74SV.js",
    "/_astro/purescript.CklMAg4u.js",
    "/_astro/python.B6aJPvgy.js",
    "/_astro/qml.Bn7K45KN.js",
    "/_astro/qmldir.C8lEn-DE.js",
    "/_astro/qss.IeuSbFQv.js",
    "/_astro/r.DiinP2Uv.js",
    "/_astro/racket.BqYA7rlc.js",
    "/_astro/raku.DXvB9xmW.js",
    "/_astro/razor.BN1najNr.js",
    "/_astro/reg.C-SQnVFl.js",
    "/_astro/regexp.CDVJQ6XC.js",
    "/_astro/rel.C3B-1QV4.js",
    "/_astro/riscv.BM1_JUlF.js",
    "/_astro/rosmsg.BJDFO7_C.js",
    "/_astro/rst.D10yH3Ta.js",
    "/_astro/ruby.B0gjitPT.js",
    "/_astro/rust.B1yitclQ.js",
    "/_astro/sas.DdhshEKr.js",
    "/_astro/sass.Cj5Yp3dK.js",
    "/_astro/scala.C151Ov-r.js",
    "/_astro/scheme.C98Dy4si.js",
    "/_astro/scss.Dd55VJtY.js",
    "/_astro/sdbl.DVxCFoDh.js",
    "/_astro/shaderlab.yPvxg9J0.js",
    "/_astro/shellscript.Yzrsuije.js",
    "/_astro/shellsession.caH0oxFO.js",
    "/_astro/smalltalk.BERRCDM3.js",
    "/_astro/solidity.rGO070M0.js",
    "/_astro/soy.B9N8wvJ7.js",
    "/_astro/sparql.DjVdNVty.js",
    "/_astro/splunk.BtCnVYZw.js",
    "/_astro/sql.BLtJtn59.js",
    "/_astro/ssh-config._ykCGR6B.js",
    "/_astro/stata.CHb5Z2Qa.js",
    "/_astro/store._78Hgpts.js",
    "/_astro/stylus.BEDo0Tqx.js",
    "/_astro/svelte.CBZA061O.js",
    "/_astro/swift.Dg5xB15N.js",
    "/_astro/system-verilog.CnnmHF94.js",
    "/_astro/systemd.4A_iFExJ.js",
    "/_astro/talonscript.CkByrt1z.js",
    "/_astro/tasl.QIJgUcNo.js",
    "/_astro/tcl.dwOrl1Do.js",
    "/_astro/templ.2dDLW-e5.js",
    "/_astro/terraform.BETggiCN.js",
    "/_astro/tex.BmUAfLkY.js",
    "/_astro/toml.vGWfd6FD.js",
    "/_astro/ts-tags.BxRApIEP.js",
    "/_astro/tsv.B_m7g4N7.js",
    "/_astro/tsx.COt5Ahok.js",
    "/_astro/turtle.BsS91CYL.js",
    "/_astro/twig.Bk2oAOvA.js",
    "/_astro/typescript.BPQ3VLAy.js",
    "/_astro/typespec.BGHnOYBU.js",
    "/_astro/typst.DHCkPAjA.js",
    "/_astro/ui-core.5vfW5kUq.js",
    "/_astro/v.BcVCzyr7.js",
    "/_astro/vala.CsfeWuGM.js",
    "/_astro/vb.D17OF-Vu.js",
    "/_astro/verilog.BQ8w6xss.js",
    "/_astro/vhdl.CeAyd5Ju.js",
    "/_astro/viml.CJc9bBzg.js",
    "/_astro/vue-html.a0q_3Za-.js",
    "/_astro/vue-vine.CrBrnmZm.js",
    "/_astro/vue.2kJ8ky7n.js",
    "/_astro/vyper.CDx5xZoG.js",
    "/_astro/wasm.CG6Dc4jp.js",
    "/_astro/wasm.MzD3tlZU.js",
    "/_astro/wenyan.BV7otONQ.js",
    "/_astro/wgsl.Dx-B1_4e.js",
    "/_astro/wikitext.BhOHFoWU.js",
    "/_astro/wit.5i3qLPDT.js",
    "/_astro/wolfram.lXgVvXCa.js",
    "/_astro/xml.CzC_-KeP.js",
    "/_astro/xsl.BYxnvhpS.js",
    "/_astro/yaml.Buea-lGh.js",
    "/_astro/zenscript.DVFEvuxE.js",
    "/_astro/zig.VOosw3JB.js",
    "/_astro/page.7qqag-5g.js",
    "/404.html",
  ],
  i18n: {
    fallbackType: "redirect",
    strategy: "pathname-prefix-other-locales",
    locales: [
      { codes: ["en"], path: "en" },
      { codes: ["ar"], path: "ar" },
      { codes: ["bs"], path: "bs" },
      { codes: ["da"], path: "da" },
      { codes: ["de"], path: "de" },
      { codes: ["es"], path: "es" },
      { codes: ["fr"], path: "fr" },
      { codes: ["it"], path: "it" },
      { codes: ["ja"], path: "ja" },
      { codes: ["ko"], path: "ko" },
      { codes: ["nb"], path: "nb" },
      { codes: ["pl"], path: "pl" },
      { codes: ["pt-BR"], path: "pt-br" },
      { codes: ["ru"], path: "ru" },
      { codes: ["th"], path: "th" },
      { codes: ["tr"], path: "tr" },
      { codes: ["zh-CN"], path: "zh-cn" },
      { codes: ["zh-TW"], path: "zh-tw" },
    ],
    defaultLocale: "en",
    domainLookupTable: {},
  },
  buildFormat: "directory",
  checkOrigin: true,
  serverIslandNameMap: [],
  key: "ApE+RENoua+wpNzIbMrviouwP3MQuBbaqPjXzF34lmM=",
})
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null

export { manifest }
