globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "Rozszerzenie slopcode dla VS Code, Cursor i innych IDE",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "stosowanie",
      text: "Stosowanie",
    },
    {
      depth: 2,
      slug: "instalacja",
      text: "Instalacja",
    },
    {
      depth: 3,
      slug: "instalacja-ręczna",
      text: "Instalacja ręczna",
    },
    {
      depth: 3,
      slug: "rozwiązywanie-problemów",
      text: "Rozwiązywanie problemów",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode integruje się z VS Code, Cursorem lub obsługującym terminal IDE. Aby uruchomić, po prostu uruchom <code dir="auto">slopcode</code> w terminalu.</p>\n<hr>\n<h2 id="stosowanie"><a href="#stosowanie">Stosowanie</a></h2>\n<ul>\n<li><strong>Szybkie uruchomienie</strong>: użycie <code dir="auto">Cmd+Esc</code> (Mac) lub <code dir="auto">Ctrl+Esc</code> (Windows/Linux), aby uruchomić slopcode w uruchamianiu terminala lub skoncentruj się na uruchamianiu terminala, jeśli jest już uruchomiony.</li>\n<li><strong>Nowa sesja</strong>: <code dir="auto">Cmd+Shift+Esc</code> (Mac) lub <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux), aby została nowa konfiguracja terminala slopcode, nawet jeśli jest już otwarta. Możesz także kliknąć przycisk slopcode w interfejsie użytkownika.</li>\n<li><strong>Świadomość kontekstu</strong>: Automatycznie udostępnia wybór lub kartę za pomocą slopcode.</li>\n<li><strong>Skróty do odwołania do plików</strong>: <code dir="auto">Cmd+Option+K</code> (Mac) lub <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows), aby wstawić odnośnik do plików. Na przykład <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="instalacja"><a href="#instalacja">Instalacja</a></h2>\n<p>Aby poznać slopcode na VS Code w forkach, takich jak Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Otwórz kod VS</li>\n<li>Otwórz innowacyjny terminal</li>\n<li>Uruchom <code dir="auto">slopcode</code> — rozszerzenie instaluje się automatycznie</li>\n</ol>\n<p>Jeśli z drugiej strony chcesz zainstalować własne IDE po uruchomieniu <code dir="auto">/editor</code> lub <code dir="auto">/export</code> z TUI, należy zainstalować <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Dowiedz się więcej</a>.</p>\n<hr>\n<h3 id="instalacja-ręczna"><a href="#instalacja-ręczna">Instalacja ręczna</a></h3>\n<p>Wyszukaj <strong>slopcode</strong> na rynku rozszerzonym i kliknij <strong>Zainstaluj</strong>.</p>\n<hr>\n<h3 id="rozwiązywanie-problemów"><a href="#rozwiązywanie-problemów">Rozwiązywanie problemów</a></h3>\n<p>Jeśli rozwiązanie nie zostanie zainstalowane automatycznie:</p>\n<ul>\n<li>zastosowanie się, że użycie <code dir="auto">slopcode</code> w terminalu.</li>\n<li>zadziałanie, że CLI dla Twojego IDE jest zainstalowane:\n<ul>\n<li>Dla kodu VS: polecenie <code dir="auto">code</code></li>\n<li>Dla kura: polecenie <code dir="auto">cursor</code></li>\n<li>Dla windsurfingu: decyzja <code dir="auto">windsurf</code></li>\n<li>Dla VSCodium: decyzja <code dir="auto">codium</code></li>\n<li>Jeśli nie, uruchom <code dir="auto">Cmd+Shift+P</code> (Mac) lub <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) i wyszukaj „Polecenie: zastosowanie decyzji„ kod ”w PATH” (lub właściwyk dla twojego IDE)</li>\n</ul>\n</li>\n<li>zadziałanie, że VS Code ma pozwolenie na instalację rozszerzoną</li>\n</ul>',
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
const url = "src/content/docs/pl/ide.mdx"
const file = "/app/packages/web/src/content/docs/pl/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/pl/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
