import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from './astro/server_CGASYgNY.mjs';

const frontmatter = {
  "title": "IDE",
  "description": "The SlopCode extension for VS Code, Cursor, Zed, and other IDEs"
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "usage",
    "text": "Usage"
  }, {
    "depth": 2,
    "slug": "installation",
    "text": "Installation"
  }, {
    "depth": 3,
    "slug": "manual-install",
    "text": "Manual Install"
  }, {
    "depth": 2,
    "slug": "zed",
    "text": "Zed"
  }, {
    "depth": 3,
    "slug": "troubleshooting",
    "text": "Troubleshooting"
  }];
}
function _createMdxContent(props) {
  const {Fragment} = props.components || ({});
  if (!Fragment) _missingMdxReference("Fragment");
  return createVNode(Fragment, {
    "set:html": "<p>SlopCode integrates with VS Code, Cursor, Zed, or any IDE that supports a terminal. Just run <code dir=\"auto\">slopcode</code> in the terminal to get started.</p>\n<hr>\n<h2 id=\"usage\"><a href=\"#usage\">Usage</a></h2>\n<ul>\n<li><strong>Quick Launch</strong>: Use <code dir=\"auto\">Cmd+Esc</code> (Mac) or <code dir=\"auto\">Ctrl+Esc</code> (Windows/Linux) to open SlopCode in a split terminal view, or focus an existing terminal session if one is already running.</li>\n<li><strong>New Session</strong>: Use <code dir=\"auto\">Cmd+Shift+Esc</code> (Mac) or <code dir=\"auto\">Ctrl+Shift+Esc</code> (Windows/Linux) to start a new SlopCode terminal session, even if one is already open. You can also click the SlopCode button in the UI.</li>\n<li><strong>Context Awareness</strong>: Automatically share your current selection or tab with SlopCode.</li>\n<li><strong>File Reference Shortcuts</strong>: Use <code dir=\"auto\">Cmd+Option+K</code> (Mac) or <code dir=\"auto\">Alt+Ctrl+K</code> (Linux/Windows) to insert file references. For example, <code dir=\"auto\">@File#L37-42</code>.</li>\n</ul>\n<hr>\n<h2 id=\"installation\"><a href=\"#installation\">Installation</a></h2>\n<p>To install SlopCode on VS Code and popular forks like Cursor, Windsurf, VSCodium:</p>\n<ol>\n<li>Open VS Code</li>\n<li>Open the integrated terminal</li>\n<li>Run <code dir=\"auto\">slopcode</code> - the extension installs automatically</li>\n</ol>\n<p>If on the other hand you want to use your own IDE when you run <code dir=\"auto\">/editor</code> or <code dir=\"auto\">/export</code> from the TUI, you’ll need to set <code dir=\"auto\">export EDITOR=\"code --wait\"</code>. <a href=\"/tui/#editor-setup\">Learn more</a>.</p>\n<hr>\n<h3 id=\"manual-install\"><a href=\"#manual-install\">Manual Install</a></h3>\n<p>Search for <strong>SlopCode</strong> in the Extension Marketplace and click <strong>Install</strong>.</p>\n<hr>\n<h2 id=\"zed\"><a href=\"#zed\">Zed</a></h2>\n<p>SlopCode also ships a Zed agent extension. The extension downloads the matching SlopCode release binary for your platform and runs <code dir=\"auto\">slopcode acp</code> as an agent server.</p>\n<p>Use Zed’s extension manager to install <strong>SlopCode</strong>, then configure providers with the normal CLI flow:</p>\n<div class=\"expressive-code\"><link rel=\"stylesheet\" href=\"/_astro/ec.4c0k7.css\"><script type=\"module\" src=\"/_astro/ec.0vx5m.js\"></script><figure class=\"frame is-terminal not-content\"><figcaption class=\"header\"><span class=\"title\"></span><span class=\"sr-only\">Terminal window</span></figcaption><pre data-language=\"bash\"><code><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#6F42C1;--1:#B392F0\">slopcode</span><span style=\"--0:#24292E;--1:#E1E4E8\"> </span><span style=\"--0:#032F62;--1:#9ECBFF\">auth</span><span style=\"--0:#24292E;--1:#E1E4E8\"> </span><span style=\"--0:#032F62;--1:#9ECBFF\">login</span></div></div></code></pre><div class=\"copy\"><div aria-live=\"polite\"></div><button title=\"Copy to clipboard\" data-copied=\"Copied!\" data-code=\"slopcode auth login\"><div></div></button></div></figure></div>\n<p>You can still run <code dir=\"auto\">slopcode</code> in Zed’s integrated terminal when you prefer the full TUI.</p>\n<hr>\n<h3 id=\"troubleshooting\"><a href=\"#troubleshooting\">Troubleshooting</a></h3>\n<p>If the extension fails to install automatically:</p>\n<ul>\n<li>Ensure you’re running <code dir=\"auto\">slopcode</code> in the integrated terminal.</li>\n<li>Confirm the CLI for your IDE is installed:\n<ul>\n<li>For VS Code: <code dir=\"auto\">code</code> command</li>\n<li>For Cursor: <code dir=\"auto\">cursor</code> command</li>\n<li>For Windsurf: <code dir=\"auto\">windsurf</code> command</li>\n<li>For VSCodium: <code dir=\"auto\">codium</code> command</li>\n<li>If not, run <code dir=\"auto\">Cmd+Shift+P</code> (Mac) or <code dir=\"auto\">Ctrl+Shift+P</code> (Windows/Linux) and search for “Shell Command: Install ‘code’ command in PATH” (or the equivalent for your IDE)</li>\n</ul>\n</li>\n<li>Ensure VS Code has permission to install extensions</li>\n</ul>"
  });
}
function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + ("component" ) + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
const url = "src/content/docs/ide.mdx";
const file = "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ide.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/home/marcos/Disk-Combined-5.5TB/Projects/Personal/slopcode/packages/web/src/content/docs/ide.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
