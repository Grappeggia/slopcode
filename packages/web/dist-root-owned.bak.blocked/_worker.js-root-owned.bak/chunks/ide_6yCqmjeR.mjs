globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "L'estensione SlopCode per VS Code, Cursor e altri IDE",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "utilizzo",
      text: "Utilizzo",
    },
    {
      depth: 2,
      slug: "installazione",
      text: "Installazione",
    },
    {
      depth: 3,
      slug: "installazione-manuale",
      text: "Installazione manuale",
    },
    {
      depth: 3,
      slug: "risoluzione-dei-problemi",
      text: "Risoluzione dei problemi",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode si integra con VS Code, Cursor o qualunque IDE che supporti un terminale. Basta eseguire <code dir="auto">slopcode</code> nel terminale per iniziare.</p>\n<hr>\n<h2 id="utilizzo"><a href="#utilizzo">Utilizzo</a></h2>\n<ul>\n<li><strong>Avvio rapido</strong>: usa <code dir="auto">Cmd+Esc</code> (Mac) o <code dir="auto">Ctrl+Esc</code> (Windows/Linux) per aprire SlopCode in una vista terminale divisa, oppure per mettere a fuoco una sessione esistente se e gia in esecuzione.</li>\n<li><strong>Nuova sessione</strong>: usa <code dir="auto">Cmd+Shift+Esc</code> (Mac) o <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) per avviare una nuova sessione di SlopCode, anche se ne esiste gia una aperta. Puoi anche cliccare il pulsante SlopCode nell’interfaccia.</li>\n<li><strong>Consapevolezza del contesto</strong>: condividi automaticamente con SlopCode la selezione corrente o la scheda attiva.</li>\n<li><strong>Scorciatoie per riferimenti file</strong>: usa <code dir="auto">Cmd+Option+K</code> (Mac) o <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) per inserire riferimenti a file. Per esempio, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="installazione"><a href="#installazione">Installazione</a></h2>\n<p>Per installare SlopCode su VS Code e fork popolari come Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Apri VS Code</li>\n<li>Apri il terminale integrato</li>\n<li>Esegui <code dir="auto">slopcode</code> - l’estensione si installa automaticamente</li>\n</ol>\n<p>Se invece vuoi usare il tuo IDE quando esegui <code dir="auto">/editor</code> o <code dir="auto">/export</code> dalla TUI, devi impostare <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Scopri di piu</a>.</p>\n<hr>\n<h3 id="installazione-manuale"><a href="#installazione-manuale">Installazione manuale</a></h3>\n<p>Cerca <strong>SlopCode</strong> nel Marketplace delle estensioni e clicca <strong>Install</strong>.</p>\n<hr>\n<h3 id="risoluzione-dei-problemi"><a href="#risoluzione-dei-problemi">Risoluzione dei problemi</a></h3>\n<p>Se l’estensione non si installa automaticamente:</p>\n<ul>\n<li>Assicurati di eseguire <code dir="auto">slopcode</code> nel terminale integrato.</li>\n<li>Verifica che la CLI del tuo IDE sia installata:\n<ul>\n<li>Per VS Code: comando <code dir="auto">code</code></li>\n<li>Per Cursor: comando <code dir="auto">cursor</code></li>\n<li>Per Windsurf: comando <code dir="auto">windsurf</code></li>\n<li>Per VSCodium: comando <code dir="auto">codium</code></li>\n<li>In caso contrario, esegui <code dir="auto">Cmd+Shift+P</code> (Mac) o <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) e cerca “Shell Command: Install ‘code’ command in PATH” (o l’equivalente per il tuo IDE)</li>\n</ul>\n</li>\n<li>Assicurati che VS Code abbia i permessi per installare estensioni</li>\n</ul>',
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
const url = "src/content/docs/it/ide.mdx"
const file = "/app/packages/web/src/content/docs/it/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/it/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
