globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "分享",
  description: "Archived page, feature outside this fork scope.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "use-providers",
      text: "Use providers",
    },
    {
      depth: 2,
      slug: "configure-setup",
      text: "Configure setup",
    },
    {
      depth: 2,
      slug: "troubleshoot-issues",
      text: "Troubleshoot issues",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>This page is archived for this slopfork.</p>\n<p>Enterprise and share features are not part of this fork docs scope.</p>\n<hr>\n<h2 id="use-providers"><a href="#use-providers">Use providers</a></h2>\n<p>Set up standard providers at <a href="/docs/providers">/docs/providers</a>.</p>\n<hr>\n<h2 id="configure-setup"><a href="#configure-setup">Configure setup</a></h2>\n<p>Configure keys and models at <a href="/docs/config">/docs/config</a>.</p>\n<hr>\n<h2 id="troubleshoot-issues"><a href="#troubleshoot-issues">Troubleshoot issues</a></h2>\n<p>Check common fixes at <a href="/docs/troubleshooting">/docs/troubleshooting</a>.</p>',
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
const url = "src/content/docs/zh-tw/share.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/share.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/share.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
