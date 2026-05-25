globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "VS Code, Cursor ve diğer IDE'ler için slopcode uzantısı",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "kullanım",
      text: "Kullanım",
    },
    {
      depth: 2,
      slug: "kurulum",
      text: "Kurulum",
    },
    {
      depth: 3,
      slug: "manuel-kurulum",
      text: "Manuel Kurulum",
    },
    {
      depth: 3,
      slug: "sorun-giderme",
      text: "Sorun giderme",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode, VS Code, Cursor veya bir terminali destekleyen herhangi bir IDE ile entegre olur. Başlamak için terminalde <code dir="auto">slopcode</code> komutunu çalıştırmanız yeterli.</p>\n<hr>\n<h2 id="kullanım"><a href="#kullanım">Kullanım</a></h2>\n<ul>\n<li><strong>Hızlı Başlatma</strong>: slopcode’u bölünmüş terminal görünümünde açmak veya zaten çalışıyorsa mevcut bir terminal oturumuna odaklanmak için <code dir="auto">Cmd+Esc</code> (Mac) veya <code dir="auto">Ctrl+Esc</code> (Windows/Linux) kullanın.</li>\n<li><strong>Yeni Oturum</strong>: Zaten açık olsa bile yeni bir slopcode terminal oturumu başlatmak için <code dir="auto">Cmd+Shift+Esc</code> (Mac) veya <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) kullanın. Ayrıca kullanıcı arayüzündeki slopcode düğmesini de tıklayabilirsiniz.</li>\n<li><strong>Bağlam Farkındalığı</strong>: Geçerli seçiminizi veya sekmenizi slopcode ile otomatik olarak paylaşın.</li>\n<li><strong>Dosya Referansı Kısayolları</strong>: Dosya referansları eklemek için <code dir="auto">Cmd+Option+K</code> (Mac) veya <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) kullanın. Örneğin, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="kurulum"><a href="#kurulum">Kurulum</a></h2>\n<p>slopcode’u VS Code’a ve Cursor, Windsurf, VSCodium gibi popüler çatallara yüklemek için:</p>\n<ol>\n<li>VS Code’u Aç</li>\n<li>Entegre terminali açın</li>\n<li><code dir="auto">slopcode</code> komutunu çalıştırın - uzantı otomatik olarak yüklenir</li>\n</ol>\n<p>TUI içinden <code dir="auto">/editor</code> veya <code dir="auto">/export</code> komutlarını çalıştırdığınızda kendi IDE’nizi kullanmak istiyorsanız <code dir="auto">export EDITOR="code --wait"</code> ayarlayın. <a href="/docs/tui/#editor-setup">Daha fazla bilgi</a>.</p>\n<hr>\n<h3 id="manuel-kurulum"><a href="#manuel-kurulum">Manuel Kurulum</a></h3>\n<p>Extension Marketplace’te <strong>slopcode</strong>’u arayın ve <strong>Yükle</strong>’ye tıklayın.</p>\n<hr>\n<h3 id="sorun-giderme"><a href="#sorun-giderme">Sorun giderme</a></h3>\n<p>Uzantı otomatik olarak yüklenemezse:</p>\n<ul>\n<li>Entegre terminalde <code dir="auto">slopcode</code> çalıştırdığınızdan emin olun.</li>\n<li>IDE cihazınız için CLI’nin kurulu olduğunu doğrulayın:\n<ul>\n<li>VS Code için: <code dir="auto">code</code> komutu</li>\n<li>Cursor için: <code dir="auto">cursor</code> komutu</li>\n<li>Windsurf için: <code dir="auto">windsurf</code> komutu</li>\n<li>VSCodium için: <code dir="auto">codium</code> komutu</li>\n<li>Değilse <code dir="auto">Cmd+Shift+P</code> (Mac) veya <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) çalıştırın ve “Shell Command: Install ‘code’ command in PATH” komutunu seçin (veya IDE’nizdeki eşdeğerini kullanın).</li>\n</ul>\n</li>\n<li>VS Code’un uzantı yükleme iznine sahip olduğundan emin olun</li>\n</ul>',
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
const url = "src/content/docs/tr/ide.mdx"
const file = "/app/packages/web/src/content/docs/tr/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/tr/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
