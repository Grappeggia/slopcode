globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "適用於 VS Code、Cursor 及其他 IDE 的 SlopCode 擴充功能",
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
      slug: "安裝",
      text: "安裝",
    },
    {
      depth: 3,
      slug: "手動安裝",
      text: "手動安裝",
    },
    {
      depth: 3,
      slug: "疑難排解",
      text: "疑難排解",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode 可與 VS Code、Cursor 或任何支援終端機的 IDE 整合。只需在終端機中執行 <code dir="auto">slopcode</code> 即可開始使用。</p>\n<hr>\n<h2 id="用法"><a href="#用法">用法</a></h2>\n<ul>\n<li><strong>快速啟動</strong>：使用 <code dir="auto">Cmd+Esc</code>（Mac）或 <code dir="auto">Ctrl+Esc</code>（Windows/Linux）在分割終端機視圖中開啟 SlopCode，如果已有終端機工作階段正在執行，則會自動聚焦到該工作階段。</li>\n<li><strong>新建工作階段</strong>：使用 <code dir="auto">Cmd+Shift+Esc</code>（Mac）或 <code dir="auto">Ctrl+Shift+Esc</code>（Windows/Linux）啟動新的 SlopCode 終端機工作階段，即使已有工作階段在執行也會新建。您也可以點選介面中的 SlopCode 按鈕。</li>\n<li><strong>上下文感知</strong>：自動將當前選取內容或分頁共享給 SlopCode。</li>\n<li><strong>檔案參照快捷鍵</strong>：使用 <code dir="auto">Cmd+Option+K</code>（Mac）或 <code dir="auto">Alt+Ctrl+K</code>（Linux/Windows）插入檔案參照。例如 <code dir="auto">@File#L37-42</code>。</li>\n</ul>\n<hr>\n<h2 id="安裝"><a href="#安裝">安裝</a></h2>\n<p>在 VS Code 及其常見分支（如 Cursor、Windsurf、VSCodium）上安裝 SlopCode：</p>\n<ol>\n<li>開啟 VS Code</li>\n<li>開啟整合終端機</li>\n<li>執行 <code dir="auto">slopcode</code>——擴充功能將自動安裝</li>\n</ol>\n<p>如果您希望在 TUI 中執行 <code dir="auto">/editor</code> 或 <code dir="auto">/export</code> 時使用自己的 IDE，需要設定 <code dir="auto">export EDITOR="code --wait"</code>。<a href="/docs/tui/#editor-setup">了解更多</a>。</p>\n<hr>\n<h3 id="手動安裝"><a href="#手動安裝">手動安裝</a></h3>\n<p>在擴充功能商店中搜尋 <strong>SlopCode</strong>，然後點選 <strong>Install</strong>。</p>\n<hr>\n<h3 id="疑難排解"><a href="#疑難排解">疑難排解</a></h3>\n<p>如果擴充功能未能自動安裝：</p>\n<ul>\n<li>確保您是在整合終端機中執行的 <code dir="auto">slopcode</code>。</li>\n<li>確認您的 IDE 對應的 CLI 指令已安裝：\n<ul>\n<li>VS Code：<code dir="auto">code</code> 指令</li>\n<li>Cursor：<code dir="auto">cursor</code> 指令</li>\n<li>Windsurf：<code dir="auto">windsurf</code> 指令</li>\n<li>VSCodium：<code dir="auto">codium</code> 指令</li>\n<li>如果未安裝，請按 <code dir="auto">Cmd+Shift+P</code>（Mac）或 <code dir="auto">Ctrl+Shift+P</code>（Windows/Linux），搜尋「Shell Command: Install ‘code’ command in PATH」（或您的 IDE 對應的指令）</li>\n</ul>\n</li>\n<li>確保 VS Code 有權限安裝擴充功能</li>\n</ul>',
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
const url = "src/content/docs/zh-tw/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
