import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_CGASYgNY.mjs"

const frontmatter = {
  title: "Workflows",
  description: "Practical ways to steer long sessions.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "queue",
      text: "Queue",
    },
    {
      depth: 2,
      slug: "split",
      text: "Split",
    },
    {
      depth: 2,
      slug: "reuse",
      text: "Reuse",
    },
    {
      depth: 2,
      slug: "review",
      text: "Review",
    },
    {
      depth: 2,
      slug: "approve",
      text: "Approve",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>These patterns help when a quick one-shot prompt turns into a longer working session.</p>\n<hr>\n<h2 id="queue"><a href="#queue">Queue</a></h2>\n<p>Leave <code dir="auto">queue_mode</code> on <code dir="auto">serial</code> to line up follow-up prompts behind the active run.</p>\n<p>That gives you predictable pause, resume, and queued prompt removal behavior.</p>\n<hr>\n<h2 id="split"><a href="#split">Split</a></h2>\n<p>Use session tabs and draft tabs to keep one thread running while you sketch the next prompt.</p>\n<p>The open-files sidebar and file explorer make it easy to keep related files close to each draft.</p>\n<hr>\n<h2 id="reuse"><a href="#reuse">Reuse</a></h2>\n<p>Switch or warp the workspace when the same conversation needs to continue in another package or nearby repo.</p>\n<p>This is handy for monorepos, generated SDKs, or paired server/client changes.</p>\n<hr>\n<h2 id="review"><a href="#review">Review</a></h2>\n<p>Use history mode to inspect past prompts, traces, tool output, and reasoning without leaving the keyboard.</p>\n<p>The prompt bar also shows phase and token pressure, which helps before you queue another large request.</p>\n<hr>\n<h2 id="approve"><a href="#approve">Approve</a></h2>\n<p>Batch permission review keeps repeated asks from interrupting every step of a build or refactor.</p>\n<p>When a run settles into safe repeated commands, preapproval options help you keep it moving.</p>',
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
const url = "src/content/docs/workflows.mdx"
const file = "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/workflows.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/workflows.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
