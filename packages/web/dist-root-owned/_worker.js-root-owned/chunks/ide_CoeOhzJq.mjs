globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "SlopCode-utvidelsen for VS Code, Cursor og andre IDE-er",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "bruk",
      text: "Bruk",
    },
    {
      depth: 2,
      slug: "installasjon",
      text: "Installasjon",
    },
    {
      depth: 3,
      slug: "manuell-installasjon",
      text: "Manuell installasjon",
    },
    {
      depth: 3,
      slug: "feilsøking",
      text: "Feilsøking",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode integreres med VS Code, Cursor eller en hvilken som helst IDE som støtter en terminal. Bare kjør <code dir="auto">slopcode</code> i terminalen for å komme i gang.</p>\n<hr>\n<h2 id="bruk"><a href="#bruk">Bruk</a></h2>\n<ul>\n<li><strong>Hurtigstart</strong>: Bruk <code dir="auto">Cmd+Esc</code> (Mac) eller <code dir="auto">Ctrl+Esc</code> (Windows/Linux) for å åpne SlopCode i en delt terminalvisning, eller fokuser en eksisterende terminaløkt hvis en allerede kjører.</li>\n<li><strong>Ny økt</strong>: Bruk <code dir="auto">Cmd+Shift+Esc</code> (Mac) eller <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) for å starte en ny SlopCode-terminaløkt, selv om en allerede er åpen. Du kan også klikke på SlopCode-knappen i UI.</li>\n<li><strong>Kontekstbevissthet</strong>: Del automatisk ditt nåværende valg eller fane med SlopCode.</li>\n<li><strong>Snarveier for filreferanser</strong>: Bruk <code dir="auto">Cmd+Option+K</code> (Mac) eller <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) for å sette inn filreferanser. For eksempel <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="installasjon"><a href="#installasjon">Installasjon</a></h2>\n<p>For å installere SlopCode på VS Code og populære varianter som Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Åpne VS Code</li>\n<li>Åpne den integrerte terminalen</li>\n<li>Kjør <code dir="auto">slopcode</code> - utvidelsen installeres automatisk</li>\n</ol>\n<p>Hvis du derimot vil bruke din egen IDE når du kjører <code dir="auto">/editor</code> eller <code dir="auto">/export</code> fra TUI, må du angi <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Finn ut mer</a>.</p>\n<hr>\n<h3 id="manuell-installasjon"><a href="#manuell-installasjon">Manuell installasjon</a></h3>\n<p>Søk etter <strong>SlopCode</strong> i Extension Marketplace og klikk på <strong>Install</strong>.</p>\n<hr>\n<h3 id="feilsøking"><a href="#feilsøking">Feilsøking</a></h3>\n<p>Hvis utvidelsen ikke kan installeres automatisk:</p>\n<ul>\n<li>Sørg for at du kjører <code dir="auto">slopcode</code> i den integrerte terminalen.</li>\n<li>Bekreft at CLI for IDE er installert:\n<ul>\n<li>For VS Code: <code dir="auto">code</code> kommando</li>\n<li>For Cursor: <code dir="auto">cursor</code> kommando</li>\n<li>For Windsurf: <code dir="auto">windsurf</code> kommando</li>\n<li>For VSCodium: <code dir="auto">codium</code> kommando</li>\n<li>Hvis ikke, kjør <code dir="auto">Cmd+Shift+P</code> (Mac) eller <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) og søk etter “Shell Command: Install ‘code’ command in PATH” (eller tilsvarende for din IDE)</li>\n</ul>\n</li>\n<li>Sørg for at VS Code har tillatelse til å installere utvidelser</li>\n</ul>',
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
const url = "src/content/docs/nb/ide.mdx"
const file = "/app/packages/web/src/content/docs/nb/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/nb/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
