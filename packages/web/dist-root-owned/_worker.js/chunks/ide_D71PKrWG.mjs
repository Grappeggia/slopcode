globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "A extensão slopcode para VS Code, Cursor e outros IDEs",
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
      slug: "instalação",
      text: "Instalação",
    },
    {
      depth: 3,
      slug: "instalação-manual",
      text: "Instalação Manual",
    },
    {
      depth: 3,
      slug: "solução-de-problemas",
      text: "Solução de Problemas",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>O slopcode integra-se com VS Code, Cursor ou qualquer IDE que suporte um terminal. Basta executar <code dir="auto">slopcode</code> no terminal para começar.</p>\n<hr>\n<h2 id="uso"><a href="#uso">Uso</a></h2>\n<ul>\n<li><strong>Lançamento Rápido</strong>: Use <code dir="auto">Cmd+Esc</code> (Mac) ou <code dir="auto">Ctrl+Esc</code> (Windows/Linux) para abrir o slopcode em uma visualização de terminal dividido, ou focar em uma sessão de terminal existente se uma já estiver em execução.</li>\n<li><strong>Nova Sessão</strong>: Use <code dir="auto">Cmd+Shift+Esc</code> (Mac) ou <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) para iniciar uma nova sessão de terminal slopcode, mesmo que uma já esteja aberta. Você também pode clicar no botão slopcode na interface.</li>\n<li><strong>Consciência de Contexto</strong>: Compartilhe automaticamente sua seleção ou aba atual com o slopcode.</li>\n<li><strong>Atalhos de Referência de Arquivo</strong>: Use <code dir="auto">Cmd+Option+K</code> (Mac) ou <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) para inserir referências de arquivo. Por exemplo, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="instalação"><a href="#instalação">Instalação</a></h2>\n<p>Para instalar o slopcode no VS Code e forks populares como Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Abra o VS Code</li>\n<li>Abra o terminal integrado</li>\n<li>Execute <code dir="auto">slopcode</code> - a extensão será instalada automaticamente</li>\n</ol>\n<p>Se, por outro lado, você quiser usar seu próprio IDE ao executar <code dir="auto">/editor</code> ou <code dir="auto">/export</code> a partir do TUI, você precisará definir <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Saiba mais</a>.</p>\n<hr>\n<h3 id="instalação-manual"><a href="#instalação-manual">Instalação Manual</a></h3>\n<p>Procure por <strong>slopcode</strong> no Marketplace de Extensões e clique em <strong>Instalar</strong>.</p>\n<hr>\n<h3 id="solução-de-problemas"><a href="#solução-de-problemas">Solução de Problemas</a></h3>\n<p>Se a extensão falhar ao instalar automaticamente:</p>\n<ul>\n<li>Certifique-se de que você está executando <code dir="auto">slopcode</code> no terminal integrado.</li>\n<li>Confirme se a CLI para seu IDE está instalado:\n<ul>\n<li>Para VS Code: comando <code dir="auto">code</code></li>\n<li>Para Cursor: comando <code dir="auto">cursor</code></li>\n<li>Para Windsurf: comando <code dir="auto">windsurf</code></li>\n<li>Para VSCodium: comando <code dir="auto">codium</code></li>\n<li>Se não, execute <code dir="auto">Cmd+Shift+P</code> (Mac) ou <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) e procure por “Shell Command: Install ‘code’ command in PATH” (ou o equivalente para seu IDE)</li>\n</ul>\n</li>\n<li>Certifique-se de que o VS Code tem permissão para instalar extensões</li>\n</ul>',
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
const url = "src/content/docs/pt-br/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
