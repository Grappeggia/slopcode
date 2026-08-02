globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "La extensión SlopCode para VS Code, Cursor y otros IDE",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "uso",
      text: "Uso",
    },
    {
      depth: 2,
      slug: "instalación",
      text: "Instalación",
    },
    {
      depth: 3,
      slug: "instalación-manual",
      text: "Instalación manual",
    },
    {
      depth: 3,
      slug: "solución-de-problemas",
      text: "Solución de problemas",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode se integra con VS Code, Cursor o cualquier IDE que admita un terminal. Simplemente ejecute <code dir="auto">slopcode</code> en la terminal para comenzar.</p>\n<hr>\n<h2 id="uso"><a href="#uso">Uso</a></h2>\n<ul>\n<li><strong>Inicio rápido</strong>: use <code dir="auto">Cmd+Esc</code> (Mac) o <code dir="auto">Ctrl+Esc</code> (Windows/Linux) para abrir SlopCode en una vista de terminal dividida, o enfoque una sesión de terminal existente si ya se está ejecutando una.</li>\n<li><strong>Nueva sesión</strong>: use <code dir="auto">Cmd+Shift+Esc</code> (Mac) o <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) para iniciar una nueva sesión de terminal SlopCode, incluso si ya hay una abierta. También puede hacer clic en el botón SlopCode en la interfaz de usuario.</li>\n<li><strong>Conciencia del contexto</strong>: comparte automáticamente tu selección o pestaña actual con SlopCode.</li>\n<li><strong>Atajos de referencia de archivos</strong>: utilice <code dir="auto">Cmd+Option+K</code> (Mac) o <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) para insertar referencias de archivos. Por ejemplo, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="instalación"><a href="#instalación">Instalación</a></h2>\n<p>Para instalar SlopCode en VS Code y bifurcaciones populares como Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Abra VS Code</li>\n<li>Abra el terminal integrado</li>\n<li>Ejecute <code dir="auto">slopcode</code>: la extensión se instala automáticamente</li>\n</ol>\n<p>Si, por otro lado, desea utilizar su propio IDE cuando ejecuta <code dir="auto">/editor</code> o <code dir="auto">/export</code> desde TUI, deberá configurar <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Más información</a>.</p>\n<hr>\n<h3 id="instalación-manual"><a href="#instalación-manual">Instalación manual</a></h3>\n<p>Busque <strong>SlopCode</strong> en Extension Marketplace y haga clic en <strong>Instalar</strong>.</p>\n<hr>\n<h3 id="solución-de-problemas"><a href="#solución-de-problemas">Solución de problemas</a></h3>\n<p>Si la extensión no se instala automáticamente:</p>\n<ul>\n<li>Asegúrese de estar ejecutando <code dir="auto">slopcode</code> en el terminal integrado.</li>\n<li>Confirme que el CLI para su IDE esté instalado:\n<ul>\n<li>Para VS Code: comando <code dir="auto">code</code></li>\n<li>Para cursor: comando <code dir="auto">cursor</code></li>\n<li>Para Windsurf: comando <code dir="auto">windsurf</code></li>\n<li>Para VSCodium: comando <code dir="auto">codium</code></li>\n<li>Si no, ejecute <code dir="auto">Cmd+Shift+P</code> (Mac) o <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) y busque “Shell Command: Install ‘code’ command in PATH” (o el equivalente para su IDE)</li>\n</ul>\n</li>\n<li>Asegúrese de que VS Code tenga permiso para instalar extensiones.</li>\n</ul>',
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
const url = "src/content/docs/es/ide.mdx"
const file = "/app/packages/web/src/content/docs/es/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/es/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
