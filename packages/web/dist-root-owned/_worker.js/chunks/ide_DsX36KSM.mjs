globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "Die SlopCode-Erweiterung für VS Code, Cursor und andere IDEs",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "verwendung",
      text: "Verwendung",
    },
    {
      depth: 2,
      slug: "installation",
      text: "Installation",
    },
    {
      depth: 3,
      slug: "manuelle-installation",
      text: "Manuelle Installation",
    },
    {
      depth: 3,
      slug: "fehlerbehebung",
      text: "Fehlerbehebung",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode lässt sich in VS Code, Cursor oder jede IDE integrieren, die ein Terminal unterstützt. Führen Sie einfach <code dir="auto">slopcode</code> im Terminal aus, um zu beginnen.</p>\n<hr>\n<h2 id="verwendung"><a href="#verwendung">Verwendung</a></h2>\n<ul>\n<li><strong>Schnellstart</strong>: Verwenden Sie <code dir="auto">Cmd+Esc</code> (Mac) oder <code dir="auto">Ctrl+Esc</code> (Windows/Linux), um SlopCode in einer geteilten Terminalansicht zu öffnen, oder fokussieren Sie eine dieser Terminalsitzung, falls bereits eine ausgeführt wird.</li>\n<li><strong>Neue Sitzung</strong>: Verwenden Sie <code dir="auto">Cmd+Shift+Esc</code> (Mac) oder <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux), um eine neue SlopCode-Terminalsitzung zu starten, auch wenn eine bereits geöffnet ist. Sie können auch auf die SlopCode-Schaltfläche im UI klicken.</li>\n<li><strong>Kontextbewusstsein</strong>: Teilen Sie Ihre aktuelle Auswahl oder Registerkarte automatisch mit SlopCode.</li>\n<li><strong>Verknüpfungen zu Dateiverweisen</strong>: Verwenden Sie <code dir="auto">Cmd+Option+K</code> (Mac) oder <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows), um Dateiverweisen einzufügen. Beispiel: <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="installation"><a href="#installation">Installation</a></h2>\n<p>So installieren Sie SlopCode in VS Code und beliebten Forks wie Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Öffnen Sie VS Code</li>\n<li>Öffnen Sie das integrierte Terminal</li>\n<li>Führen Sie <code dir="auto">slopcode</code> aus – die Erweiterung wird automatisch installiert</li>\n</ol>\n<p>Wenn Sie andererseits Ihre eigene IDE verwenden möchten, wenn Sie <code dir="auto">/editor</code> oder <code dir="auto">/export</code> von TUI ausführen, müssen Sie <code dir="auto">export EDITOR="code --wait"</code> festlegen. <a href="/docs/tui/#editor-setup">Learn more</a>.</p>\n<hr>\n<h3 id="manuelle-installation"><a href="#manuelle-installation">Manuelle Installation</a></h3>\n<p>Suchen Sie im Extension Marketplace nach <strong>SlopCode</strong> und klicken Sie auf <strong>Installieren</strong>.</p>\n<hr>\n<h3 id="fehlerbehebung"><a href="#fehlerbehebung">Fehlerbehebung</a></h3>\n<p>Wenn die Erweiterung nicht automatisch installiert werden kann:</p>\n<ul>\n<li>Stellen Sie sicher, dass Sie <code dir="auto">slopcode</code> im integrierten Terminal ausführen.</li>\n<li>Bestätigen Sie, dass CLI für Ihre IDE installiert ist:\n<ul>\n<li>Für VS Code: <code dir="auto">code</code> Befehl</li>\n<li>Für Cursor: Befehl <code dir="auto">cursor</code></li>\n<li>Für Windsurf: Befehl <code dir="auto">windsurf</code></li>\n<li>Für VSCodium: Befehl <code dir="auto">codium</code></li>\n<li>Wenn nicht, führen Sie <code dir="auto">Cmd+Shift+P</code> (Mac) oder <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) aus und suchen Sie nach „Shell Command: Install ‘code’ command in PATH“ (oder dem Äquivalent für Ihre IDE).</li>\n</ul>\n</li>\n<li>Stellen Sie sicher, dass VS Code über die Berechtigung zum Installieren von Erweiterungen verfügt</li>\n</ul>',
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
const url = "src/content/docs/de/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/de/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
