globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "L'extension SlopCode pour VS Code, Cursor et autres IDE",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "utilisation",
      text: "Utilisation",
    },
    {
      depth: 2,
      slug: "installation",
      text: "Installation",
    },
    {
      depth: 3,
      slug: "installation-manuelle",
      text: "Installation manuelle",
    },
    {
      depth: 3,
      slug: "dépannage",
      text: "Dépannage",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode s’intègre à VS Code, Cursor ou tout IDE prenant en charge un terminal. Exécutez simplement <code dir="auto">slopcode</code> dans le terminal pour commencer.</p>\n<hr>\n<h2 id="utilisation"><a href="#utilisation">Utilisation</a></h2>\n<ul>\n<li><strong>Lancement rapide</strong> : utilisez <code dir="auto">Cmd+Esc</code> (Mac) ou <code dir="auto">Ctrl+Esc</code> (Windows/Linux) pour ouvrir SlopCode dans une vue de terminal divisée, ou focus sur une session de terminal existante si elle est déjà en cours d’exécution.</li>\n<li><strong>Nouvelle session</strong> : utilisez <code dir="auto">Cmd+Shift+Esc</code> (Mac) ou <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) pour démarrer une nouvelle session de terminal SlopCode, même si elle est déjà ouverte. Vous pouvez également cliquer sur le bouton SlopCode dans l’interface utilisateur.</li>\n<li><strong>Contexte</strong> : partagez automatiquement votre sélection ou onglet actuel avec SlopCode.</li>\n<li><strong>Raccourcis de référence de fichier</strong> : utilisez <code dir="auto">Cmd+Option+K</code> (Mac) ou <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) pour insérer des références de fichier. Par exemple, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="installation"><a href="#installation">Installation</a></h2>\n<p>Pour installer SlopCode sur VS Code et les forks populaires comme Cursor, Windsurf, VSCodium :</p>\n<ol>\n<li>Ouvrir VS Code</li>\n<li>Ouvrez le terminal intégré</li>\n<li>Exécutez <code dir="auto">slopcode</code> - l’extension s’installe automatiquement</li>\n</ol>\n<p>Si, d’un autre côté, vous souhaitez utiliser votre propre IDE lorsque vous exécutez <code dir="auto">/editor</code> ou <code dir="auto">/export</code> à partir du TUI, vous devrez définir <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">En savoir plus</a>.</p>\n<hr>\n<h3 id="installation-manuelle"><a href="#installation-manuelle">Installation manuelle</a></h3>\n<p>Recherchez <strong>SlopCode</strong> dans Extension Marketplace et cliquez sur <strong>Installer</strong>.</p>\n<hr>\n<h3 id="dépannage"><a href="#dépannage">Dépannage</a></h3>\n<p>Si l’extension ne parvient pas à s’installer automatiquement :</p>\n<ul>\n<li>Assurez-vous que vous exécutez <code dir="auto">slopcode</code> dans le terminal intégré.</li>\n<li>Confirmez que la CLI de votre IDE est installée :\n<ul>\n<li>Pour VS Code : commande <code dir="auto">code</code></li>\n<li>Pour Cursor : commande <code dir="auto">cursor</code></li>\n<li>Pour Windsurf : commande <code dir="auto">windsurf</code></li>\n<li>Pour VSCodium : commande <code dir="auto">codium</code></li>\n<li>Sinon, exécutez <code dir="auto">Cmd+Shift+P</code> (Mac) ou <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) et recherchez « Shell Command: Install ‘code’ command in PATH » (ou l’équivalent pour votre IDE)</li>\n</ul>\n</li>\n<li>Assurez-vous que VS Code est autorisé à installer des extensions</li>\n</ul>',
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
const url = "src/content/docs/fr/ide.mdx"
const file = "/app/packages/web/src/content/docs/fr/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/fr/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
