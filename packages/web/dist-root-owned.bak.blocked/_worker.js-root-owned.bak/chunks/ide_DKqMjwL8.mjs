globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "SlopCode-udvidelsen til VS Code, Cursor og andre IDE'er",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "brug",
      text: "Brug",
    },
    {
      depth: 2,
      slug: "installation",
      text: "Installation",
    },
    {
      depth: 3,
      slug: "manuel-installation",
      text: "Manuel installation",
    },
    {
      depth: 3,
      slug: "fejlfinding",
      text: "Fejlfinding",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode integreres med VS Code, Cursor eller enhver IDE, der understøtter en terminal. Bare kør <code dir="auto">slopcode</code> i terminalen for at komme i gang.</p>\n<hr>\n<h2 id="brug"><a href="#brug">Brug</a></h2>\n<ul>\n<li><strong>Hurtig start</strong>: Brug <code dir="auto">Cmd+Esc</code> (Mac) eller <code dir="auto">Ctrl+Esc</code> (Windows/Linux) til at åbne SlopCode i en delt terminalvisning, eller fokuser en eksisterende terminalsession, hvis en allerede kører.</li>\n<li><strong>Ny session</strong>: Brug <code dir="auto">Cmd+Shift+Esc</code> (Mac) eller <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) til at starte en ny SlopCode terminalsession, mulighed en allerede er åben. Du kan også klikke på knappen SlopCode i brugergrænsefladen.</li>\n<li><strong>Kontekstbevidsthed</strong>: Del automatisk dit nuværende valg eller din fane med SlopCode.</li>\n<li><strong>Filreferencegenveje</strong>: Brug <code dir="auto">Cmd+Option+K</code> (Mac) eller <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) til at indsætte filreferencer. For eksempel <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="installation"><a href="#installation">Installation</a></h2>\n<p>Sådan installeres SlopCode på VS Code og populære gafler som Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Åbn VS Code</li>\n<li>Åbn den integrerede terminal</li>\n<li>Kør <code dir="auto">slopcode</code> - udvidelsen installeres automatisk</li>\n</ol>\n<p>Hvis du på den anden side vil bruge din egen IDE, når du kører <code dir="auto">/editor</code> eller <code dir="auto">/export</code> fra TUI, skal du indstille <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Learn more</a>.</p>\n<hr>\n<h3 id="manuel-installation"><a href="#manuel-installation">Manuel installation</a></h3>\n<p>Søg efter <strong>SlopCode</strong> i Extension Marketplace, og klik på <strong>Installer</strong>.</p>\n<hr>\n<h3 id="fejlfinding"><a href="#fejlfinding">Fejlfinding</a></h3>\n<p>Hvis udvidelsen ikke kan installeres automatisk:</p>\n<ul>\n<li>Sørg for, at du kører <code dir="auto">slopcode</code> i den integrerede terminal.</li>\n<li>Bekræft, at CLI for din IDE er installeret:\n<ul>\n<li>For VS Code: <code dir="auto">code</code> kommando</li>\n<li>For Cursor: <code dir="auto">cursor</code> kommando</li>\n<li>For Windsurf: <code dir="auto">windsurf</code> kommando</li>\n<li>For VSCodium: <code dir="auto">codium</code> kommando</li>\n<li>Hvis ikke, så kør <code dir="auto">Cmd+Shift+P</code> (Mac) eller <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) og søg efter “Shell Command: Install ‘code’ command in PATH” (eller tilsvarende for din IDE)</li>\n</ul>\n</li>\n<li>Sørg for, at VS Code har tilladelse til at installere udvidelser</li>\n</ul>',
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
const url = "src/content/docs/da/ide.mdx"
const file = "/app/packages/web/src/content/docs/da/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/da/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
