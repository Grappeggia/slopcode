globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "IDE",
  description: "VS Code, Cursor 및 기타 IDE용 SlopCode 확장 프로그램",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "사용법",
      text: "사용법",
    },
    {
      depth: 2,
      slug: "설치",
      text: "설치",
    },
    {
      depth: 3,
      slug: "수동-설치",
      text: "수동 설치",
    },
    {
      depth: 3,
      slug: "문제-해결",
      text: "문제 해결",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode는 VS Code, Cursor, 또는 터미널을 지원하는 모든 IDE와 통합됩니다. 시작하려면 터미널에서 <code dir="auto">slopcode</code>를 실행하세요.</p>\n<hr>\n<h2 id="사용법"><a href="#사용법">사용법</a></h2>\n<ul>\n<li><strong>Quick Launch</strong>: <code dir="auto">Cmd+Esc</code> (Mac) 또는 <code dir="auto">Ctrl+Esc</code> (Windows/Linux)를 사용해 분할 터미널 뷰에서 SlopCode를 열거나, 이미 실행 중인 터미널 세션으로 포커스하세요.</li>\n<li><strong>New Session</strong>: <code dir="auto">Cmd+Shift+Esc</code> (Mac) 또는 <code dir="auto">Ctrl+Shift+Esc</code> (Windows/Linux)를 사용해 기존 세션이 열려 있어도 새 SlopCode 터미널 세션을 시작하세요. UI의 SlopCode 버튼을 클릭해도 됩니다.</li>\n<li><strong>Context Awareness</strong>: 현재 선택 영역이나 탭을 SlopCode와 자동으로 공유합니다.</li>\n<li><strong>File Reference Shortcuts</strong>: <code dir="auto">Cmd+Option+K</code> (Mac) 또는 <code dir="auto">Alt+Ctrl+K</code> (Linux/Windows)를 사용해 파일 참조를 삽입하세요. 예: <code dir="auto">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id="설치"><a href="#설치">설치</a></h2>\n<p>VS Code와 Cursor, Windsurf, VSCodium 같은 인기 포크에 SlopCode를 설치하려면:</p>\n<ol>\n<li>VS Code를 여세요.4</li>\n<li>통합 터미널을 여세요.</li>\n<li><code dir="auto">slopcode</code>를 실행하세요. 확장 프로그램이 자동으로 설치됩니다.</li>\n</ol>\n<p>반면 TUI에서 <code dir="auto">/editor</code> 또는 <code dir="auto">/export</code>를 실행할 때 자체 IDE를 사용하려면 <code dir="auto">export EDITOR="code --wait"</code>를 설정해야 합니다. <a href="/docs/tui/#editor-setup">자세히 알아보기</a>.</p>\n<hr>\n<h3 id="수동-설치"><a href="#수동-설치">수동 설치</a></h3>\n<p>Extension Marketplace에서 <strong>SlopCode</strong>를 검색한 다음 <strong>Install</strong>을 클릭하세요.</p>\n<hr>\n<h3 id="문제-해결"><a href="#문제-해결">문제 해결</a></h3>\n<p>확장이 자동으로 설치되지 않는 경우:</p>\n<ul>\n<li>통합 터미널에서 <code dir="auto">slopcode</code>를 실행하고 있는지 확인하세요.</li>\n<li>IDE용 CLI가 설치되어 있는지 확인하세요.\n<ul>\n<li>VS Code: <code dir="auto">code</code> command</li>\n<li>Cursor: <code dir="auto">cursor</code> command</li>\n<li>Windsurf: <code dir="auto">windsurf</code> command</li>\n<li>VSCodium: <code dir="auto">codium</code> command</li>\n<li>설치되어 있지 않다면 <code dir="auto">Cmd+Shift+P</code> (Mac) 또는 <code dir="auto">Ctrl+Shift+P</code> (Windows/Linux)를 실행하고 “Shell Command: Install ‘code’ command in PATH”(또는 IDE에 맞는 동등한 명령)를 검색하세요.</li>\n</ul>\n</li>\n<li>VS Code에 확장 프로그램 설치 권한이 있는지 확인하세요.</li>\n</ul>',
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
const url = "src/content/docs/ko/ide.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ide.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ko/ide.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
