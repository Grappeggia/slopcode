globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "适用于 VS Code、Cursor 及其他 IDE 的 SlopCode 扩展",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "用法",
      text: "用法",
    },
    {
      depth: 2,
      slug: "安装",
      text: "安装",
    },
    {
      depth: 3,
      slug: "手动安装",
      text: "手动安装",
    },
    {
      depth: 3,
      slug: "故障排除",
      text: "故障排除",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode 可与 VS Code、Cursor 或任何支持终端的 IDE 集成。只需在终端中运行 <code dir="auto">slopcode</code> 即可开始使用。</p>\n<hr>\n<h2 id="用法"><a href="#用法">用法</a></h2>\n<ul>\n<li><strong>快速启动</strong>：使用 <code dir="auto">Cmd+Esc</code>（Mac）或 <code dir="auto">Ctrl+Esc</code>（Windows/Linux）在分屏终端视图中打开 SlopCode，如果已有终端会话正在运行，则会自动聚焦到该会话。</li>\n<li><strong>新建会话</strong>：使用 <code dir="auto">Cmd+Shift+Esc</code>（Mac）或 <code dir="auto">Ctrl+Shift+Esc</code>（Windows/Linux）启动新的 SlopCode 终端会话，即使已有会话在运行也会新建。你也可以点击界面中的 SlopCode 按钮。</li>\n<li><strong>上下文感知</strong>：自动将当前选中内容或标签页共享给 SlopCode。</li>\n<li><strong>文件引用快捷键</strong>：使用 <code dir="auto">Cmd+Option+K</code>（Mac）或 <code dir="auto">Alt+Ctrl+K</code>（Linux/Windows）插入文件引用。例如 <code dir="auto">@File#L37-42</code>。</li>\n</ul>\n<hr>\n<h2 id="安装"><a href="#安装">安装</a></h2>\n<p>在 VS Code 及其常见分支（如 Cursor、Windsurf、VSCodium）上安装 SlopCode：</p>\n<ol>\n<li>打开 VS Code</li>\n<li>打开集成终端</li>\n<li>运行 <code dir="auto">slopcode</code>——扩展将自动安装</li>\n</ol>\n<p>如果你希望在 TUI 中执行 <code dir="auto">/editor</code> 或 <code dir="auto">/export</code> 时使用自己的 IDE，需要设置 <code dir="auto">export EDITOR="code --wait"</code>。<a href="/docs/tui/#editor-setup">了解更多</a>。</p>\n<hr>\n<h3 id="手动安装"><a href="#手动安装">手动安装</a></h3>\n<p>在扩展商店中搜索 <strong>SlopCode</strong>，然后点击 <strong>Install</strong>。</p>\n<hr>\n<h3 id="故障排除"><a href="#故障排除">故障排除</a></h3>\n<p>如果扩展未能自动安装：</p>\n<ul>\n<li>确保你是在集成终端中运行的 <code dir="auto">slopcode</code>。</li>\n<li>确认你的 IDE 对应的 CLI 命令已安装：\n<ul>\n<li>VS Code：<code dir="auto">code</code> 命令</li>\n<li>Cursor：<code dir="auto">cursor</code> 命令</li>\n<li>Windsurf：<code dir="auto">windsurf</code> 命令</li>\n<li>VSCodium：<code dir="auto">codium</code> 命令</li>\n<li>如果未安装，请按 <code dir="auto">Cmd+Shift+P</code>（Mac）或 <code dir="auto">Ctrl+Shift+P</code>（Windows/Linux），搜索 “Shell Command: Install ‘code’ command in PATH”（或你的 IDE 对应的命令）</li>\n</ul>\n</li>\n<li>确保 VS Code 有权限安装扩展</li>\n</ul>',
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
const url = "src/content/docs/zh-cn/ide.mdx"
const file = "/app/packages/web/src/content/docs/zh-cn/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/zh-cn/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
