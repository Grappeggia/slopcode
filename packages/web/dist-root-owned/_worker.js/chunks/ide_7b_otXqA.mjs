globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "Ekstenzija SlopCode za VS Code, Cursor i druge IDE",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "korištenje",
      text: "Korištenje",
    },
    {
      depth: 2,
      slug: "instalacija",
      text: "Instalacija",
    },
    {
      depth: 3,
      slug: "ručna-instalacija",
      text: "Ručna instalacija",
    },
    {
      depth: 3,
      slug: "rješavanje-problema",
      text: "Rješavanje problema",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode se integriše sa VS kodom, Cursor-om ili bilo kojim IDE-om koji podržava terminal. Samo pokrenite <code dir="auto">slopcode</code> u terminalu da započnete.</p>\n<hr>\n<h2 id="korištenje"><a href="#korištenje">Korištenje</a></h2>\n<ul>\n<li><strong>Brzo pokretanje</strong>: Koristite <code dir="auto">Cmd+Esc</code> (Mac) ili <code dir="auto">Ctrl+Esc</code> (Windows/Linux) da otvorite SlopCode u prikazu podijeljenog terminala ili fokusirajte postojeću terminalsku sesiju ako je već pokrenuta.</li>\n<li><strong>Nova sesija</strong>: Koristite <code dir="auto">Cmd+Shift+Esc</code> (Mac) ili <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) da započnete novu SlopCode terminalsku sesiju, čak i ako je ona već otvorena. Takođe možete kliknuti na dugme SlopCode u korisničkom sučelju.</li>\n<li><strong>Svijest o kontekstu</strong>: Automatski dijelite svoj trenutni odabir ili karticu s SlopCode.</li>\n<li><strong>Prečice za referencu datoteka</strong>: Koristite <code dir="auto">Cmd+Option+K</code> (Mac) ili <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) za umetanje referenci datoteka. Na primjer, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="instalacija"><a href="#instalacija">Instalacija</a></h2>\n<p>Da biste instalirali SlopCode na VS Code i popularne viljuške kao što su Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Otvorite VS Code</li>\n<li>Otvorite integrirani terminal</li>\n<li>Pokrenite <code dir="auto">slopcode</code> - ekstenzija se automatski instalira\nAko s druge strane želite da koristite svoj vlastiti IDE kada pokrenete <code dir="auto">/editor</code> ili <code dir="auto">/export</code> iz TUI-ja, morat ćete postaviti <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Saznajte više</a>.</li>\n</ol>\n<hr>\n<h3 id="ručna-instalacija"><a href="#ručna-instalacija">Ručna instalacija</a></h3>\n<p>Potražite <strong>SlopCode</strong> na Extension Marketplaceu i kliknite na <strong>Instaliraj</strong>.</p>\n<hr>\n<h3 id="rješavanje-problema"><a href="#rješavanje-problema">Rješavanje problema</a></h3>\n<p>Ako se ekstenzija ne uspije automatski instalirati:</p>\n<ul>\n<li>Uvjerite se da koristite <code dir="auto">slopcode</code> u integriranom terminalu.</li>\n<li>Potvrdite da je CLI za vaš IDE instaliran:\n<ul>\n<li>Za VS kod: <code dir="auto">code</code> naredbu</li>\n<li>Za Cursor: <code dir="auto">cursor</code> naredba</li>\n<li>Za Windsurf: <code dir="auto">windsurf</code> komanda</li>\n<li>Za VSCodium: <code dir="auto">codium</code> komanda</li>\n<li>Ako ne, pokrenite <code dir="auto">Cmd+Shift+P</code> (Mac) ili <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) i potražite “Shell Command: Install ‘code’ command in PATH” (ili ekvivalent za vaš IDE)</li>\n</ul>\n</li>\n<li>Osigurajte da VS Code ima dozvolu za instaliranje ekstenzija</li>\n</ul>',
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
const url = "src/content/docs/bs/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/bs/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
