import {
  a as createComponent,
  b as renderTemplate,
  e as addAttribute,
  m as maybeRenderHead,
  d as createVNode,
  F as Fragment,
  _ as __astro_tag_component__,
} from "./astro/server_CGASYgNY.mjs"
/* empty css                                                                      */

var __freeze = Object.freeze
var __defProp = Object.defineProperty
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }))
var _a
const $$GitHubReleases = createComponent(
  async ($$result, $$props, $$slots) => {
    const endpoint = "https://api.github.com/repos/teamslop/slopcode/releases?per_page=12"
    const releaseUrl = "https://github.com/teamslop/slopcode/releases"
    const parse = (body) => {
      if (typeof body !== "string" || body.length === 0) return []
      const lines = body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      const bullets = lines
        .filter((line) => line.startsWith("- ") || /^\d+\.\s/.test(line))
        .map((line) =>
          line
            .replace(/^-+\s+/, "")
            .replace(/^\d+\.\s+/, "")
            .trim(),
        )
        .filter((line) => line.length > 0 && !line.startsWith("**Thank you"))
      if (bullets.length > 0) return bullets.slice(0, 4)
      const text = lines.find((line) => !line.startsWith("#") && !line.startsWith("**Thank you"))
      if (!text) return []
      return [text]
    }
    const valid = (release) => {
      if (!release || typeof release !== "object") return false
      const item = release
      return (
        typeof item.tag_name === "string" &&
        typeof item.html_url === "string" &&
        typeof item.published_at === "string" &&
        (typeof item.body === "string" || item.body === null) &&
        typeof item.draft === "boolean" &&
        typeof item.prerelease === "boolean"
      )
    }
    const releases = await fetch(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) =>
        Array.isArray(data)
          ? data
              .filter(valid)
              .filter((release) => !release.draft && !release.prerelease)
              .slice(0, 10)
          : [],
      )
      .catch(() => [])
    const format = (value) =>
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    return renderTemplate(
      _a ||
        (_a = __template(
          [
            "",
            '<div class="release-feed astro-vxiwmhm6" data-release-feed',
            "",
            "> <p data-release-loading",
            ' class="astro-vxiwmhm6">Loading latest releases from GitHub...</p> <p data-release-error hidden class="astro-vxiwmhm6">\nCould not load releases right now. <a',
            ' class="astro-vxiwmhm6">View all releases on GitHub</a>.\n</p> <div data-release-list',
            ' class="astro-vxiwmhm6"> ',
            ' </div> </div> <script>\n  const feeds = document.querySelectorAll("[data-release-feed]")\n\n  const parseNotes = (body) => {\n    if (typeof body !== "string" || body.length === 0) return []\n\n    const lines = body\n      .split("\\n")\n      .map((line) => line.trim())\n      .filter((line) => line.length > 0)\n\n    const bullets = lines\n      .filter((line) => line.startsWith("- ") || /^\\d+\\.\\s/.test(line))\n      .map((line) => line.replace(/^-+\\s+/, "").replace(/^\\d+\\.\\s+/, "").trim())\n      .filter((line) => line.length > 0 && !line.startsWith("**Thank you"))\n\n    if (bullets.length > 0) return bullets.slice(0, 4)\n\n    const text = lines.find((line) => !line.startsWith("#") && !line.startsWith("**Thank you"))\n    if (!text) return []\n    return [text]\n  }\n\n  const formatDate = (value) => {\n    if (typeof value !== "string" || value.length === 0) return ""\n\n    const date = new Date(value)\n    if (Number.isNaN(date.getTime())) return ""\n\n    return new Intl.DateTimeFormat(undefined, {\n      year: "numeric",\n      month: "short",\n      day: "numeric",\n    }).format(date)\n  }\n\n  const render = (node, releases) => {\n    node.replaceChildren()\n\n    for (const release of releases) {\n      const section = document.createElement("section")\n      const title = document.createElement("h3")\n      const link = document.createElement("a")\n\n      link.href = release.html_url\n      link.textContent = release.tag_name\n      link.target = "_blank"\n      link.rel = "noopener noreferrer"\n\n      title.append(link)\n      section.append(title)\n\n      const date = formatDate(release.published_at)\n      if (date) {\n        const meta = document.createElement("p")\n        meta.className = "release-date"\n        meta.textContent = date\n        section.append(meta)\n      }\n\n      const notes = parseNotes(release.body)\n      if (notes.length > 0) {\n        const list = document.createElement("ul")\n        for (const note of notes) {\n          const item = document.createElement("li")\n          item.textContent = note\n          list.append(item)\n        }\n        section.append(list)\n      }\n\n      node.append(section)\n    }\n  }\n\n  for (const feed of feeds) {\n    if (!(feed instanceof HTMLElement)) continue\n\n    const endpoint = feed.dataset.endpoint\n    const loading = feed.querySelector("[data-release-loading]")\n    const error = feed.querySelector("[data-release-error]")\n    const list = feed.querySelector("[data-release-list]")\n\n    if (\n      typeof endpoint !== "string" ||\n      !(loading instanceof HTMLElement) ||\n      !(error instanceof HTMLElement) ||\n      !(list instanceof HTMLElement)\n    ) {\n      continue\n    }\n\n    fetch(endpoint, {\n      headers: {\n        Accept: "application/vnd.github+json",\n      },\n    })\n      .then((response) => {\n        if (!response.ok) throw new Error("Could not load releases")\n        return response.json()\n      })\n      .then((data) => {\n        if (!Array.isArray(data)) throw new Error("Invalid release payload")\n\n        return data\n          .filter((release) => release && !release.draft && !release.prerelease)\n          .slice(0, 10)\n      })\n      .then((releases) => {\n        loading.hidden = true\n        error.hidden = true\n        list.hidden = false\n        render(list, releases)\n      })\n      .catch(() => {\n        loading.hidden = true\n        if (list.children.length === 0) error.hidden = false\n      })\n  }\n<\/script> ',
          ],
          [
            "",
            '<div class="release-feed astro-vxiwmhm6" data-release-feed',
            "",
            "> <p data-release-loading",
            ' class="astro-vxiwmhm6">Loading latest releases from GitHub...</p> <p data-release-error hidden class="astro-vxiwmhm6">\nCould not load releases right now. <a',
            ' class="astro-vxiwmhm6">View all releases on GitHub</a>.\n</p> <div data-release-list',
            ' class="astro-vxiwmhm6"> ',
            ' </div> </div> <script>\n  const feeds = document.querySelectorAll("[data-release-feed]")\n\n  const parseNotes = (body) => {\n    if (typeof body !== "string" || body.length === 0) return []\n\n    const lines = body\n      .split("\\\\n")\n      .map((line) => line.trim())\n      .filter((line) => line.length > 0)\n\n    const bullets = lines\n      .filter((line) => line.startsWith("- ") || /^\\\\d+\\\\.\\\\s/.test(line))\n      .map((line) => line.replace(/^-+\\\\s+/, "").replace(/^\\\\d+\\\\.\\\\s+/, "").trim())\n      .filter((line) => line.length > 0 && !line.startsWith("**Thank you"))\n\n    if (bullets.length > 0) return bullets.slice(0, 4)\n\n    const text = lines.find((line) => !line.startsWith("#") && !line.startsWith("**Thank you"))\n    if (!text) return []\n    return [text]\n  }\n\n  const formatDate = (value) => {\n    if (typeof value !== "string" || value.length === 0) return ""\n\n    const date = new Date(value)\n    if (Number.isNaN(date.getTime())) return ""\n\n    return new Intl.DateTimeFormat(undefined, {\n      year: "numeric",\n      month: "short",\n      day: "numeric",\n    }).format(date)\n  }\n\n  const render = (node, releases) => {\n    node.replaceChildren()\n\n    for (const release of releases) {\n      const section = document.createElement("section")\n      const title = document.createElement("h3")\n      const link = document.createElement("a")\n\n      link.href = release.html_url\n      link.textContent = release.tag_name\n      link.target = "_blank"\n      link.rel = "noopener noreferrer"\n\n      title.append(link)\n      section.append(title)\n\n      const date = formatDate(release.published_at)\n      if (date) {\n        const meta = document.createElement("p")\n        meta.className = "release-date"\n        meta.textContent = date\n        section.append(meta)\n      }\n\n      const notes = parseNotes(release.body)\n      if (notes.length > 0) {\n        const list = document.createElement("ul")\n        for (const note of notes) {\n          const item = document.createElement("li")\n          item.textContent = note\n          list.append(item)\n        }\n        section.append(list)\n      }\n\n      node.append(section)\n    }\n  }\n\n  for (const feed of feeds) {\n    if (!(feed instanceof HTMLElement)) continue\n\n    const endpoint = feed.dataset.endpoint\n    const loading = feed.querySelector("[data-release-loading]")\n    const error = feed.querySelector("[data-release-error]")\n    const list = feed.querySelector("[data-release-list]")\n\n    if (\n      typeof endpoint !== "string" ||\n      !(loading instanceof HTMLElement) ||\n      !(error instanceof HTMLElement) ||\n      !(list instanceof HTMLElement)\n    ) {\n      continue\n    }\n\n    fetch(endpoint, {\n      headers: {\n        Accept: "application/vnd.github+json",\n      },\n    })\n      .then((response) => {\n        if (!response.ok) throw new Error("Could not load releases")\n        return response.json()\n      })\n      .then((data) => {\n        if (!Array.isArray(data)) throw new Error("Invalid release payload")\n\n        return data\n          .filter((release) => release && !release.draft && !release.prerelease)\n          .slice(0, 10)\n      })\n      .then((releases) => {\n        loading.hidden = true\n        error.hidden = true\n        list.hidden = false\n        render(list, releases)\n      })\n      .catch(() => {\n        loading.hidden = true\n        if (list.children.length === 0) error.hidden = false\n      })\n  }\n<\/script> ',
          ],
        )),
      maybeRenderHead(),
      addAttribute(endpoint, "data-endpoint"),
      addAttribute(releases.length > 0 ? "true" : "false", "data-has-releases"),
      addAttribute(releases.length > 0, "hidden"),
      addAttribute(releaseUrl, "href"),
      addAttribute(releases.length === 0, "hidden"),
      releases.map(
        (release) =>
          renderTemplate`<section class="astro-vxiwmhm6"> <h3 class="astro-vxiwmhm6"> <a${addAttribute(release.html_url, "href")} target="_blank" rel="noopener noreferrer" class="astro-vxiwmhm6"> ${release.tag_name} </a> </h3> <p class="release-date astro-vxiwmhm6">${format(release.published_at)}</p> ${parse(release.body).length > 0 && renderTemplate`<ul class="astro-vxiwmhm6"> ${parse(release.body).map((note) => renderTemplate`<li class="astro-vxiwmhm6">${note}</li>`)} </ul>`} </section>`,
      ),
    )
  },
  "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/components/GitHubReleases.astro",
  void 0,
)

const frontmatter = {
  title: "Changelog",
  description: "Release notes for SlopCode.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "latest-releases",
      text: "Latest releases",
    },
    {
      depth: 2,
      slug: "version-highlights",
      text: "Version highlights",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment: Fragment$1 } = props.components || {}
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>This page tracks notable SlopCode releases and updates directly from GitHub.</p>\n<hr>\n<h2 id="latest-releases"><a href="#latest-releases">Latest releases</a></h2>\n<ul>\n<li><a href="https://github.com/teamslop/slopcode/releases">View all releases on GitHub</a></li>\n<li><a href="https://github.com/teamslop/slopcode">Watch repository activity</a></li>\n</ul>\n<hr>\n<h2 id="version-highlights"><a href="#version-highlights">Version highlights</a></h2>\n',
      }),
      createVNode($$GitHubReleases, {}),
      "\n",
      createVNode(Fragment$1, {
        "set:html": "<hr>\n<p>For full details and patch-level changes, use the GitHub releases link above.</p>",
      }),
    ],
  })
}
function MDXContent(props = {}) {
  const { wrapper: MDXLayout } = props.components || {}
  return MDXLayout
    ? createVNode(MDXLayout, {
        ...props,
        children: createVNode(_createMdxContent, {
          ...props,
        }),
      })
    : _createMdxContent(props)
}
function _missingMdxReference(id, component) {
  throw new Error(
    "Expected " + "component" + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.",
  )
}

const url = "src/content/docs/changelog.mdx"
const file = "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/changelog.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/changelog.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
