globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "VS Code、Cursor、およびその他の IDE 用の SlopCode 拡張機能",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "使用法",
      text: "使用法",
    },
    {
      depth: 2,
      slug: "インストール",
      text: "インストール",
    },
    {
      depth: 3,
      slug: "手動インストール",
      text: "手動インストール",
    },
    {
      depth: 3,
      slug: "トラブルシューティング",
      text: "トラブルシューティング",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode は、VS Code、Cursor、またはターミナルをサポートする任意の IDE と統合します。開始するには、ターミナルで <code dir="auto">slopcode</code> を実行するだけです。</p>\n<hr>\n<h2 id="使用法"><a href="#使用法">使用法</a></h2>\n<ul>\n<li><strong>クイック起動</strong>: <code dir="auto">Cmd+Esc</code> (Mac) または <code dir="auto">Ctrl+Esc</code> (Windows/Linux) を使用して、分割ターミナルビューで SlopCode を開くか、既存のターミナルセッションが既に実行されている場合はそれにフォーカスします。</li>\n<li><strong>新しいセッション</strong>: すでに開いている場合でも、<code dir="auto">Cmd+Shift+Esc</code> (Mac) または <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) を使用して、新しい SlopCode ターミナルセッションを開始します。 UI の [SlopCode] ボタンをクリックすることもできます。</li>\n<li><strong>コンテキスト認識</strong>: 現在の選択またはタブを SlopCode と自動的に共有します。</li>\n<li><strong>ファイル参照のショートカット</strong>: ファイル参照を挿入するには、<code dir="auto">Cmd+Option+K</code> (Mac) または <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) を使用します。たとえば、<code dir="auto">@File#L37-42</code>。</li>\n</ul>\n<hr>\n<h2 id="インストール"><a href="#インストール">インストール</a></h2>\n<p>SlopCode を VS Code および Cursor、Windsurf、VSCodium などの一般的なフォークにインストールするには:</p>\n<ol>\n<li>VS Code を開く</li>\n<li>統合ターミナルを開きます</li>\n<li><code dir="auto">slopcode</code> を実行します - 拡張機能は自動的にインストールされます</li>\n</ol>\n<p>一方、TUI から <code dir="auto">/editor</code> または <code dir="auto">/export</code> を実行するときに独自の IDE を使用したい場合は、<code dir="auto">export EDITOR="code --wait"</code> を設定する必要があります。 <a href="/docs/tui/#editor-setup">詳細はこちら</a>。</p>\n<hr>\n<h3 id="手動インストール"><a href="#手動インストール">手動インストール</a></h3>\n<p>Extension Marketplace で <strong>SlopCode</strong> を検索し、<strong>インストール</strong> をクリックします。</p>\n<hr>\n<h3 id="トラブルシューティング"><a href="#トラブルシューティング">トラブルシューティング</a></h3>\n<p>拡張機能が自動的にインストールされない場合:</p>\n<ul>\n<li>統合ターミナルで <code dir="auto">slopcode</code> を実行していることを確認してください。</li>\n<li>IDE の CLI がインストールされていることを確認します。\n<ul>\n<li>VS Code の場合: <code dir="auto">code</code> コマンド</li>\n<li>Cursor の場合: <code dir="auto">cursor</code> コマンド</li>\n<li>Windsurf の場合: <code dir="auto">windsurf</code> コマンド</li>\n<li>VSCodium の場合: <code dir="auto">codium</code> コマンド</li>\n<li>そうでない場合は、<code dir="auto">Cmd+Shift+P</code> (Mac) または <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) を実行し、「Shell Command: Install ‘code’ command in PATH」(または IDE の同等のコマンド) を検索します。</li>\n</ul>\n</li>\n<li>VS Code に拡張機能をインストールする権限があることを確認してください</li>\n</ul>',
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
const url = "src/content/docs/ja/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
