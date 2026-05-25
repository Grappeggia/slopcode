globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "امتداد SlopCode لـ VS Code و Cursor وغيرها من بيئات التطوير",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "الاستخدام",
      text: "الاستخدام",
    },
    {
      depth: 2,
      slug: "التثبيت",
      text: "التثبيت",
    },
    {
      depth: 3,
      slug: "التثبيت-اليدوي",
      text: "التثبيت اليدوي",
    },
    {
      depth: 3,
      slug: "استكشاف-الأخطاء-وإصلاحها",
      text: "استكشاف الأخطاء وإصلاحها",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>يتكامل SlopCode مع VS Code و Cursor أو أي IDE يدعم terminal. ما عليك سوى تشغيل <code dir="auto">slopcode</code> في terminal للبدء.</p>\n<hr>\n<h2 id="الاستخدام"><a href="#الاستخدام">الاستخدام</a></h2>\n<ul>\n<li><strong>تشغيل سريع</strong>: استخدم <code dir="auto">Cmd+Esc</code> (Mac) أو <code dir="auto">Ctrl+Esc</code> (Windows/Linux) لفتح SlopCode في عرض terminal مقسّم، أو للتركيز على جلسة terminal موجودة إذا كانت قيد التشغيل بالفعل.</li>\n<li><strong>جلسة جديدة</strong>: استخدم <code dir="auto">Cmd+Shift+Esc</code> (Mac) أو <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) لبدء جلسة terminal جديدة لـ SlopCode حتى لو كانت هناك جلسة مفتوحة. يمكنك أيضا النقر على زر SlopCode في واجهة المستخدم.</li>\n<li><strong>وعي بالسياق</strong>: شارك تلقائيا تحديدك الحالي أو تبويبك مع SlopCode.</li>\n<li><strong>اختصارات الإشارة إلى الملفات</strong>: استخدم <code dir="auto">Cmd+Option+K</code> (Mac) أو <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) لإدراج مراجع الملفات. مثلا: <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="التثبيت"><a href="#التثبيت">التثبيت</a></h2>\n<p>لتثبيت SlopCode على VS Code والتفرعات الشائعة مثل Cursor و Windsurf و VSCodium:</p>\n<ol>\n<li>افتح VS Code</li>\n<li>افتح terminal المدمجة</li>\n<li>شغّل <code dir="auto">slopcode</code> - سيتم تثبيت الامتداد تلقائيا</li>\n</ol>\n<p>أما إذا كنت تريد استخدام IDE الخاص بك عند تشغيل <code dir="auto">/editor</code> أو <code dir="auto">/export</code> من واجهة TUI، فستحتاج إلى ضبط <code dir="auto">export EDITOR="code --wait"</code>. <a href="/docs/tui/#editor-setup">اعرف المزيد</a>.</p>\n<hr>\n<h3 id="التثبيت-اليدوي"><a href="#التثبيت-اليدوي">التثبيت اليدوي</a></h3>\n<p>ابحث عن <strong>SlopCode</strong> في Extension Marketplace وانقر <strong>Install</strong>.</p>\n<hr>\n<h3 id="استكشاف-الأخطاء-وإصلاحها"><a href="#استكشاف-الأخطاء-وإصلاحها">استكشاف الأخطاء وإصلاحها</a></h3>\n<p>إذا فشل تثبيت الامتداد تلقائيا:</p>\n<ul>\n<li>تأكد من أنك تشغّل <code dir="auto">slopcode</code> داخل terminal المدمجة.</li>\n<li>تأكد من تثبيت CLI الخاصة بـ IDE لديك:\n<ul>\n<li>لـ VS Code: أمر <code dir="auto">code</code></li>\n<li>لـ Cursor: أمر <code dir="auto">cursor</code></li>\n<li>لـ Windsurf: أمر <code dir="auto">windsurf</code></li>\n<li>لـ VSCodium: أمر <code dir="auto">codium</code></li>\n<li>إذا لم تكن مثبتة، شغّل <code dir="auto">Cmd+Shift+P</code> (Mac) أو <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) وابحث عن “Shell Command: Install ‘code’ command in PATH” (أو ما يعادله في IDE لديك)</li>\n</ul>\n</li>\n<li>تأكد من أن VS Code لديه الصلاحية لتثبيت الامتدادات</li>\n</ul>',
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
const url = "src/content/docs/ar/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
