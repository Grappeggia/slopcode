globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "Расширение slopcode для VS Code, Cursor и других IDE.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "использование",
      text: "Использование",
    },
    {
      depth: 2,
      slug: "установка",
      text: "Установка",
    },
    {
      depth: 3,
      slug: "ручная-установка",
      text: "Ручная установка",
    },
    {
      depth: 3,
      slug: "устранение-неполадок",
      text: "Устранение неполадок",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode интегрируется с VS Code, Cursor или любой IDE, поддерживающей терминал. Просто запустите <code dir="auto">slopcode</code> в терминале, чтобы начать.</p>\n<hr>\n<h2 id="использование"><a href="#использование">Использование</a></h2>\n<ul>\n<li><strong>Быстрый запуск</strong>: используйте <code dir="auto">Cmd+Esc</code> (Mac) или <code dir="auto">Ctrl+Esc</code> (Windows/Linux), чтобы открыть slopcode в разделенном представлении терминала, или сфокусируйтесь на существующем сеансе терминала, если он уже запущен.</li>\n<li><strong>Новый сеанс</strong>: используйте <code dir="auto">Cmd+Shift+Esc</code> (Mac) или <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux), чтобы начать новый сеанс терминала slopcode, даже если он уже открыт. Вы также можете нажать кнопку slopcode в пользовательском интерфейсе.</li>\n<li><strong>Осведомленность о контексте</strong>: автоматически делитесь своим текущим выбором или вкладкой с помощью slopcode.</li>\n<li><strong>Шорткаты ссылок на файлы</strong>: Используйте <code dir="auto">Cmd+Option+K</code> (Mac) или <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) для вставки ссылок на файлы. Например, <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="установка"><a href="#установка">Установка</a></h2>\n<p>Чтобы установить slopcode на VS Code и популярные форки, такие как Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Откройте VS Code</li>\n<li>Откройте встроенный терминал</li>\n<li>Запустите <code dir="auto">slopcode</code> — расширение установится автоматически.</li>\n</ol>\n<p>С другой стороны, если вы хотите использовать собственную IDE при запуске <code dir="auto">/editor</code> или <code dir="auto">/export</code> из TUI, вам необходимо установить <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">Подробнее</a>.</p>\n<hr>\n<h3 id="ручная-установка"><a href="#ручная-установка">Ручная установка</a></h3>\n<p>Найдите <strong>slopcode</strong> в магазине расширений и нажмите <strong>Установить</strong>.</p>\n<hr>\n<h3 id="устранение-неполадок"><a href="#устранение-неполадок">Устранение неполадок</a></h3>\n<p>Если расширение не устанавливается автоматически:</p>\n<ul>\n<li>Убедитесь, что вы используете <code dir="auto">slopcode</code> во встроенном терминале.</li>\n<li>Убедитесь, что CLI для вашей IDE установлен:\n<ul>\n<li>Для Code: команда <code dir="auto">code</code>.</li>\n<li>Для Cursor: команда <code dir="auto">cursor</code>.</li>\n<li>Для Windsurf: команда <code dir="auto">windsurf</code>.</li>\n<li>Для VSCodium: команда <code dir="auto">codium</code>.</li>\n<li>Если нет, запустите <code dir="auto">Cmd+Shift+P</code> (Mac) или <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) и найдите “Shell Command: Install ‘code’ command in PATH” (или эквивалент для вашей IDE).</li>\n</ul>\n</li>\n<li>Убедитесь, что у VS Code есть разрешение на установку расширений.</li>\n</ul>',
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
const url = "src/content/docs/ru/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ru/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
