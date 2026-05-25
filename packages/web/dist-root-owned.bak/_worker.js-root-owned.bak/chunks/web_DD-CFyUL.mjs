globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { $ as $$Image } from "./_astro_assets_VXEWGxWQ.mjs"
import {
  _ as __0__________assets_web_web_homepage_new_session_png__,
  a as __1__________assets_web_web_homepage_active_session_png__,
  b as __2__________assets_web_web_homepage_see_servers_png__,
} from "./web-homepage-see-servers_SodOMcu-.mjs"

const frontmatter = {
  title: "Web",
  description: "Bruke SlopCode i nettleseren din.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "komme-i-gang",
      text: "Komme i gang",
    },
    {
      depth: 2,
      slug: "konfigurasjon",
      text: "Konfigurasjon",
    },
    {
      depth: 3,
      slug: "port",
      text: "Port",
    },
    {
      depth: 3,
      slug: "vertsnavn",
      text: "Vertsnavn",
    },
    {
      depth: 3,
      slug: "autentisering",
      text: "Autentisering",
    },
    {
      depth: 2,
      slug: "bruke-webgrensesnittet",
      text: "Bruke webgrensesnittet",
    },
    {
      depth: 3,
      slug: "sesjoner",
      text: "Sesjoner",
    },
    {
      depth: 3,
      slug: "serverstatus",
      text: "Serverstatus",
    },
    {
      depth: 2,
      slug: "koble-til-en-terminal",
      text: "Koble til en terminal",
    },
    {
      depth: 2,
      slug: "konfigurasjonsfil",
      text: "Konfigurasjonsfil",
    },
  ]
}
const __usesAstroImage = true
function _createMdxContent(props) {
  const _components = {
      "astro-image": "astro-image",
      p: "p",
      ...props.components,
    },
    _component0 = _components["astro-image"],
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          "<p>SlopCode kan kjøres som en nettapplikasjon i nettleseren din, og gir den samme kraftige AI-kodingsopplevelsen uten at du trenger en terminal.</p>\n",
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "SlopCode Web - Ny økt",
          src: __0__________assets_web_web_homepage_new_session_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<h2 id="komme-i-gang"><a href="#komme-i-gang">Komme i gang</a></h2>\n<p>Start web-grensesnittet ved å kjøre:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p>Dette starter en lokal server på <code dir="auto">127.0.0.1</code> med en tilfeldig tilgjengelig port og åpner automatisk SlopCode i standard nettleser.</p>\n<hr>\n<h2 id="konfigurasjon"><a href="#konfigurasjon">Konfigurasjon</a></h2>\n<p>Du kan konfigurere webserveren ved å bruke kommandolinjeflagg eller i <a href="/docs/config">konfigurasjonsfilen</a>.</p>\n<h3 id="port"><a href="#port">Port</a></h3>\n<p>Som standard velger SlopCode en tilgjengelig port. Du kan spesifisere en port:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096"><div></div></button></div></figure></div>\n<h3 id="vertsnavn"><a href="#vertsnavn">Vertsnavn</a></h3>\n<p>Som standard binder serveren seg til <code dir="auto">127.0.0.1</code> (kun localhost). Slik gjør du SlopCode tilgjengelig på nettverket ditt:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --hostname 0.0.0.0"><div></div></button></div></figure></div>\n<hr>\n<h3 id="autentisering"><a href="#autentisering">Autentisering</a></h3>\n<p>For å beskytte tilgang, angi et passord ved hjelp av miljøvariabelen <code dir="auto">SLOPCODE_SERVER_PASSWORD</code>:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">secret</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=secret slopcode web"><div></div></button></div></figure></div>\n<p>Brukernavnet er satt til <code dir="auto">slopcode</code> som standard, men kan endres med <code dir="auto">SLOPCODE_SERVER_USERNAME</code>.</p>\n<hr>\n<h2 id="bruke-webgrensesnittet"><a href="#bruke-webgrensesnittet">Bruke webgrensesnittet</a></h2>\n<p>Når den er startet, gir nettgrensesnittet tilgang til dine SlopCode-økter.</p>\n<h3 id="sesjoner"><a href="#sesjoner">Sesjoner</a></h3>\n<p>Se og administrer øktene dine fra hjemmesiden. Du kan se aktive økter og starte nye.</p>\n',
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "SlopCode Web - Active Session",
          src: __1__________assets_web_web_homepage_active_session_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<h3 id="serverstatus"><a href="#serverstatus">Serverstatus</a></h3>\n<p>Klikk på “Se servere” for å se tilkoblede servere og deres status.</p>\n',
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "SlopCode Web - Se servere",
          src: __2__________assets_web_web_homepage_see_servers_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="koble-til-en-terminal"><a href="#koble-til-en-terminal">Koble til en terminal</a></h2>\n<p>Du kan koble en terminal TUI til en kjørende webserver:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the web server</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096slopcode attach http://localhost:4096"><div></div></button></div></figure></div>\n<p>Dette lar deg bruke både nettgrensesnittet og terminalen samtidig, og deler samme økter og tilstand.</p>\n<hr>\n<h2 id="konfigurasjonsfil"><a href="#konfigurasjonsfil">Konfigurasjonsfil</a></h2>\n<p>Du kan også konfigurere serverinnstillinger i <code dir="auto">slopcode.json</code> konfigurasjonsfilen:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="json"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"server"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"port"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"hostname"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"0.0.0.0"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"mdns"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"cors"</span><span style="--0:#24292E;--1:#E1E4E8">: [</span><span style="--0:#032F62;--1:#9ECBFF">"https://example.com"</span><span style="--0:#24292E;--1:#E1E4E8">]</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;server&#x22;: {    &#x22;port&#x22;: 4096,    &#x22;hostname&#x22;: &#x22;0.0.0.0&#x22;,    &#x22;mdns&#x22;: true,    &#x22;cors&#x22;: [&#x22;https://example.com&#x22;]  }}"><div></div></button></div></figure></div>\n<p>Kommandolinjeflagg har forrang over konfigurasjonsfilinnstillinger.</p>',
      }),
    ],
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

const url = "src/content/docs/nb/web.mdx"
const file = "/app/packages/web/src/content/docs/nb/web.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/nb/web.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, __usesAstroImage, Content as default, file, frontmatter, getHeadings, url }
