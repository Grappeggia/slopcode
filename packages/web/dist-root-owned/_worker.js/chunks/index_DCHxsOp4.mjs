globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Intro",
  description: "Quick setup for your first SlopCode session.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "install",
      text: "Install",
    },
    {
      depth: 2,
      slug: "connect",
      text: "Connect",
    },
    {
      depth: 2,
      slug: "start",
      text: "Start",
    },
    {
      depth: 2,
      slug: "prompt",
      text: "Prompt",
    },
    {
      depth: 2,
      slug: "explore",
      text: "Explore",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p><a href="/">SlopCode</a> is an open source coding agent focused on terminal workflows.\nThis page gets you from install to first prompt quickly.</p>\n<hr>\n<h2 id="install"><a href="#install">Install</a></h2>\n<p>Use the install script.</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">curl</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-fsSL</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://slopcode.dev/install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">|</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">bash</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="curl -fsSL https://slopcode.dev/install | bash"><div></div></button></div></figure></div>\n<p>Prefer a package manager? Use one of these commands.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-g</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">slopcode</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">bun</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-g</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">slopcode</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">brew</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">slopcode</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">curl</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-fsSL</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://teamslop.github.io/apt-slopcode/install.sh</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">|</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">sudo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">bash</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install -g slopcodebun install -g slopcodebrew install slopcodecurl -fsSL https://teamslop.github.io/apt-slopcode/install.sh | sudo bash"><div></div></button></div></figure></div>\n<hr>\n<h2 id="connect"><a href="#connect">Connect</a></h2>\n<p>Run <code dir="auto">/connect</code> and choose the provider you already use.\nYou can switch providers later at any time.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="txt"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">/connect</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/connect"><div></div></button></div></figure></div>\n<hr>\n<h2 id="start"><a href="#start">Start</a></h2>\n<p>Open a project and launch SlopCode.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#005CC5;--1:#79B8FF">cd</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/path/to/project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="cd /path/to/projectslopcode"><div></div></button></div></figure></div>\n<p>Initialize project instructions once.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="txt"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">/init</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/init"><div></div></button></div></figure></div>\n<p>Commit the generated <code dir="auto">AGENTS.md</code> file so future sessions keep the same context.</p>\n<hr>\n<h2 id="prompt"><a href="#prompt">Prompt</a></h2>\n<p>Ask for one concrete task and include file paths when useful.\nShort, specific prompts usually give better edits.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="txt"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">Add request logging to </span><mark><span style="--0:#24292e;--1:#e1e4e8">@src/api.ts</span></mark><span style="--0:#24292e;--1:#e1e4e8"> and include a unit test</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="Add request logging to @src/api.ts and include a unit test"><div></div></button></div></figure></div>\n<hr>\n<h2 id="explore"><a href="#explore">Explore</a></h2>\n<p>Read these next pages when you need more control.</p>\n<ul>\n<li><a href="/docs/cli">CLI</a></li>\n<li><a href="/docs/providers">Providers</a></li>\n<li><a href="/docs/config">Configuration</a></li>\n<li><a href="/docs/tools">Tools</a></li>\n<li><a href="/docs/troubleshooting">Troubleshooting</a></li>\n</ul>',
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
const url = "src/content/docs/index.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/index.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/index.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
