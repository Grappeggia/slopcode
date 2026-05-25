globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "ส่วนขยาย SlopCode สำหรับ VS Code, Cursor และ IDE อื่นๆ",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "การใช้งาน",
      text: "การใช้งาน",
    },
    {
      depth: 2,
      slug: "การติดตั้ง",
      text: "การติดตั้ง",
    },
    {
      depth: 3,
      slug: "ติดตั้งด้วยตนเอง",
      text: "ติดตั้งด้วยตนเอง",
    },
    {
      depth: 3,
      slug: "การแก้ไขปัญหา",
      text: "การแก้ไขปัญหา",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode ทำงานร่วมกับ VS Code, Cursor หรือ IDE ใดๆ ที่รองรับ terminal เพียงเรียกใช้ <code dir="auto">slopcode</code> ใน terminal เพื่อเริ่มต้น</p>\n<hr>\n<h2 id="การใช้งาน"><a href="#การใช้งาน">การใช้งาน</a></h2>\n<ul>\n<li><strong>เปิดใช้ด่วน</strong>: ใช้ <code dir="auto">Cmd+Esc</code> (Mac) หรือ <code dir="auto">Ctrl+Esc</code> (Windows/Linux) เพื่อเปิด SlopCode ในมุมมอง terminal แบบแยก หรือเน้นเซสชัน terminal ที่มีอยู่หากมีการทำงานอยู่แล้ว</li>\n<li><strong>เซสชันใหม่</strong>: ใช้ <code dir="auto">Cmd+Shift+Esc</code> (Mac) หรือ <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux) เพื่อเริ่มเซสชัน terminal SlopCode ใหม่ แม้ว่าเซสชันหนึ่งจะเปิดอยู่แล้วก็ตาม คุณยังสามารถคลิกปุ่ม SlopCode ใน UI ได้ด้วย</li>\n<li><strong>การรับรู้บริบท</strong>: แชร์การเลือกหรือแท็บปัจจุบันของคุณโดยอัตโนมัติด้วย SlopCode</li>\n<li><strong>ทางลัดการอ้างอิงไฟล์</strong>: ใช้ <code dir="auto">Cmd+Option+K</code> (Mac) หรือ <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows) เพื่อแทรกการอ้างอิงไฟล์ ตัวอย่างเช่น <code dir="auto">@File#L37-42</code></li>\n</ul>\n<hr>\n<h2 id="การติดตั้ง"><a href="#การติดตั้ง">การติดตั้ง</a></h2>\n<p>วิธีติดตั้ง SlopCode บน VS Code และทางแยกยอดนิยม เช่น Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>เปิด VS Code</li>\n<li>เปิด terminal รวม</li>\n<li>เรียกใช้ <code dir="auto">slopcode</code> - ​​ส่วนขยายจะติดตั้งโดยอัตโนมัติ</li>\n</ol>\n<p>ในทางกลับกัน หากคุณต้องการใช้ IDE ของคุณเองเมื่อคุณเรียกใช้ <code dir="auto">/editor</code> หรือ <code dir="auto">/export</code> จาก TUI คุณจะต้องตั้งค่า <code dir="auto">export EDITOR="code --wait"</code> <a href="/docs/tui/#editor-setup">เรียนรู้เพิ่มเติม</a></p>\n<hr>\n<h3 id="ติดตั้งด้วยตนเอง"><a href="#ติดตั้งด้วยตนเอง">ติดตั้งด้วยตนเอง</a></h3>\n<p>ค้นหา <strong>SlopCode</strong> ใน Extension Marketplace แล้วคลิก <strong>ติดตั้ง</strong></p>\n<hr>\n<h3 id="การแก้ไขปัญหา"><a href="#การแก้ไขปัญหา">การแก้ไขปัญหา</a></h3>\n<p>หากส่วนขยายไม่สามารถติดตั้งได้โดยอัตโนมัติ:</p>\n<ul>\n<li>ตรวจสอบให้แน่ใจว่าคุณใช้งาน <code dir="auto">slopcode</code> ใน terminal รวม</li>\n<li>ยืนยันว่า CLI สำหรับ IDE ของคุณได้รับการติดตั้งแล้ว:\n<ul>\n<li>สำหรับ VS Code: <code dir="auto">code</code> คำสั่ง</li>\n<li>สำหรับ Cursor: <code dir="auto">cursor</code> คำสั่ง</li>\n<li>สำหรับ Windsurf: <code dir="auto">windsurf</code> คำสั่ง</li>\n<li>สำหรับ VSCodium: <code dir="auto">codium</code> คำสั่ง</li>\n<li>ถ้าไม่เช่นนั้น ให้รัน <code dir="auto">Cmd+Shift+P</code> (Mac) หรือ <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux) และค้นหา “Shell Command: Install ‘code’ command in PATH” (หรือเทียบเท่ากับ IDE ของคุณ)</li>\n</ul>\n</li>\n<li>ตรวจสอบให้แน่ใจว่ารหัส VS มีสิทธิ์ในการติดตั้งส่วนขยาย</li>\n</ul>',
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
const url = "src/content/docs/th/ide.mdx"
const file = "/app/packages/web/src/content/docs/th/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/th/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
