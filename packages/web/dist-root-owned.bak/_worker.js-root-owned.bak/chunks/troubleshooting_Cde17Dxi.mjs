globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Feilsøking",
  description: "Vanlige problemer og hvordan de kan løses.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "logger",
      text: "Logger",
    },
    {
      depth: 2,
      slug: "lagring",
      text: "Lagring",
    },
    {
      depth: 2,
      slug: "skrivebordsapp",
      text: "Skrivebordsapp",
    },
    {
      depth: 3,
      slug: "raske-sjekker",
      text: "Raske sjekker",
    },
    {
      depth: 3,
      slug: "deaktiver-plugins",
      text: "Deaktiver plugins",
    },
    {
      depth: 4,
      slug: "sjekk-den-globale-konfigurasjonen",
      text: "Sjekk den globale konfigurasjonen",
    },
    {
      depth: 4,
      slug: "sjekk-plugin-kataloger",
      text: "Sjekk plugin-kataloger",
    },
    {
      depth: 3,
      slug: "tøm-hurtigbufferen",
      text: "Tøm hurtigbufferen",
    },
    {
      depth: 3,
      slug: "løs-problemer-med-servertilkobling",
      text: "Løs problemer med servertilkobling",
    },
    {
      depth: 4,
      slug: "slett-skrivebordsappens-standardserver-url",
      text: "Slett skrivebordsappens standardserver-URL",
    },
    {
      depth: 4,
      slug: "fjern-serverport--serverhostname-fra-konfigurasjonen-din",
      text: "Fjern server.port / server.hostname fra konfigurasjonen din",
    },
    {
      depth: 4,
      slug: "sjekk-miljøvariabler",
      text: "Sjekk miljøvariabler",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-problemer",
      text: "Linux: Wayland / X11 problemer",
    },
    {
      depth: 3,
      slug: "windows-webview2-kjøretid",
      text: "Windows: WebView2 kjøretid",
    },
    {
      depth: 3,
      slug: "windows-generelle-ytelsesproblemer",
      text: "Windows: Generelle ytelsesproblemer",
    },
    {
      depth: 3,
      slug: "varsler-vises-ikke",
      text: "Varsler vises ikke",
    },
    {
      depth: 3,
      slug: "tilbakestill-skrivebordsapplagring-siste-utvei",
      text: "Tilbakestill skrivebordsapplagring (siste utvei)",
    },
    {
      depth: 3,
      slug: "modellen-er-ikke-tilgjengelig",
      text: "Modellen er ikke tilgjengelig",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-og-leverandørpakkeproblemer",
      text: "AI_APICallError og leverandørpakkeproblemer",
    },
    {
      depth: 3,
      slug: "kopierlim-inn-fungerer-ikke-på-linux",
      text: "Kopier/lim inn fungerer ikke på Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>For å feilsøke problemer med SlopCode, start med å sjekke loggene og lokale data den lagrer på disken.</p>\n<hr>\n<h2 id="logger"><a href="#logger">Logger</a></h2>\n<p>Loggfiler skrives til:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Trykk <code dir="auto">WIN+R</code> og lim inn <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Loggfiler navngis med tidsstempler (f.eks. <code dir="auto">2025-01-09T123456.log</code>) og de siste 10 loggfilene beholdes.</p>\n<p>Du kan angi loggnivået med kommandolinjealternativet <code dir="auto">--log-level</code> for å få mer detaljert feilsøkingsinformasjon. For eksempel <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="lagring"><a href="#lagring">Lagring</a></h2>\n<p>SlopCode lagrer øktdata og andre applikasjonsdata på disken på:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Trykk <code dir="auto">WIN+R</code> og lim inn <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Denne katalogen inneholder:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Autentiseringsdata som API-nøkler, OAuth-tokens</li>\n<li><code dir="auto">log/</code> - Applikasjonslogger</li>\n<li><code dir="auto">project/</code> - Prosjektspesifikke data som økt- og meldingsdata\n<ul>\n<li>Hvis prosjektet er innenfor en Git-repo, lagres det i <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Hvis det ikke er en Git-repo, lagres det i <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="skrivebordsapp"><a href="#skrivebordsapp">Skrivebordsapp</a></h2>\n<p>SlopCode Desktop kjører en lokal SlopCode-server (<code dir="auto">slopcode-cli</code> sidevognen) i bakgrunnen. De fleste problemene er forårsaket av en plugin som fungerer dårlig, en ødelagt cache eller en dårlig serverinnstilling.</p>\n<h3 id="raske-sjekker"><a href="#raske-sjekker">Raske sjekker</a></h3>\n<ul>\n<li>Avslutt og start appen på nytt.</li>\n<li>Hvis appen viser en feilskjerm, klikker du på <strong>Start på nytt</strong> og kopierer feildetaljene.</li>\n<li>Bare macOS: <code dir="auto">SlopCode</code>-meny -> <strong>Last nettvisning på nytt</strong> (hjelper hvis UI er tom/frosset).</li>\n</ul>\n<hr>\n<h3 id="deaktiver-plugins"><a href="#deaktiver-plugins">Deaktiver plugins</a></h3>\n<p>Hvis skrivebordsappen krasjer ved oppstart, henger eller oppfører seg merkelig, start med å deaktivere plugins.</p>\n<h4 id="sjekk-den-globale-konfigurasjonen"><a href="#sjekk-den-globale-konfigurasjonen">Sjekk den globale konfigurasjonen</a></h4>\n<p>Åpne den globale konfigurasjonsfilen og se etter en <code dir="auto">plugin</code>-nøkkel.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (eller <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (eldre installasjoner): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Trykk <code dir="auto">WIN+R</code> og lim inn <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Hvis du har konfigurert plugins, deaktiver dem midlertidig ved å fjerne nøkkelen eller sette den til en tom matrise:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="sjekk-plugin-kataloger"><a href="#sjekk-plugin-kataloger">Sjekk plugin-kataloger</a></h4>\n<p>SlopCode kan også laste lokale plugins fra disken. Flytt disse midlertidig ut av veien (eller gi nytt navn til mappen) og start skrivebordsappen på nytt:</p>\n<ul>\n<li><strong>Globale plugins</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Trykk <code dir="auto">WIN+R</code> og lim inn <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Prosjektplugins</strong> (bare hvis du bruker konfigurasjon per prosjekt)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Hvis appen begynner å fungere igjen, aktiverer du plugins én om gangen for å finne ut hvilken som forårsaker problemet.</p>\n<hr>\n<h3 id="tøm-hurtigbufferen"><a href="#tøm-hurtigbufferen">Tøm hurtigbufferen</a></h3>\n<p>Hvis deaktivering av plugins ikke hjelper (eller en plugin-installasjon sitter fast), tøm hurtigbufferen slik at SlopCode kan gjenoppbygge den.</p>\n<ol>\n<li>Avslutt SlopCode Desktop helt.</li>\n<li>Slett hurtigbufferkatalogen:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> lim inn <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: slett <code dir="auto">~/.cache/slopcode</code> (eller kjør <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Trykk <code dir="auto">WIN+R</code> og lim inn <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Start SlopCode Desktop på nytt.</li>\n</ol>\n<hr>\n<h3 id="løs-problemer-med-servertilkobling"><a href="#løs-problemer-med-servertilkobling">Løs problemer med servertilkobling</a></h3>\n<p>SlopCode Desktop kan enten starte sin egen lokale server (standard) eller koble til en server URL du har konfigurert.</p>\n<p>Hvis du ser en <strong>“Tilkobling mislyktes”</strong>-dialogboks (eller appen kommer aldri forbi splash-skjermen), se etter en tilpasset server URL.</p>\n<h4 id="slett-skrivebordsappens-standardserver-url"><a href="#slett-skrivebordsappens-standardserver-url">Slett skrivebordsappens standardserver-URL</a></h4>\n<p>Fra startskjermen klikker du på servernavnet (med statusprikken) for å åpne servervelgeren. I delen <strong>Standardserver</strong> klikker du på <strong>Slett</strong>.</p>\n<h4 id="fjern-serverport--serverhostname-fra-konfigurasjonen-din"><a href="#fjern-serverport--serverhostname-fra-konfigurasjonen-din">Fjern <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> fra konfigurasjonen din</a></h4>\n<p>Hvis <code dir="auto">slopcode.json(c)</code> inneholder en <code dir="auto">server</code>-del, fjern den midlertidig og start skrivebordsappen på nytt.</p>\n<h4 id="sjekk-miljøvariabler"><a href="#sjekk-miljøvariabler">Sjekk miljøvariabler</a></h4>\n<p>Hvis du har <code dir="auto">SLOPCODE_PORT</code> satt i miljøet ditt, vil skrivebordsappen prøve å bruke den porten for den lokale serveren.</p>\n<ul>\n<li>Deaktiver <code dir="auto">SLOPCODE_PORT</code> (eller velg en ledig port) og start på nytt.</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-problemer"><a href="#linux-wayland--x11-problemer">Linux: Wayland / X11 problemer</a></h3>\n<p>På Linux kan noen Wayland-oppsett forårsake tomme vinduer eller kompositorfeil.</p>\n<ul>\n<li>Hvis du er på Wayland og appen er tom/krasj, prøv å starte med <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Hvis det gjør ting verre, fjern det og prøv å starte under en X11-økt i stedet.</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-kjøretid"><a href="#windows-webview2-kjøretid">Windows: WebView2 kjøretid</a></h3>\n<p>På Windows krever SlopCode Desktop Microsoft Edge <strong>WebView2 Runtime</strong>. Hvis appen åpnes i et tomt vindu eller ikke starter, installer/oppdater WebView2 og prøv igjen.</p>\n<hr>\n<h3 id="windows-generelle-ytelsesproblemer"><a href="#windows-generelle-ytelsesproblemer">Windows: Generelle ytelsesproblemer</a></h3>\n<p>Hvis du opplever treg ytelse, problemer med filtilgang eller terminalproblemer på Windows, kan du prøve å bruke <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>. WSL gir et Linux-miljø som fungerer mer sømløst med funksjonene til SlopCode.</p>\n<hr>\n<h3 id="varsler-vises-ikke"><a href="#varsler-vises-ikke">Varsler vises ikke</a></h3>\n<p>SlopCode Desktop viser bare systemvarsler når:</p>\n<ul>\n<li>varsler er aktivert for SlopCode i OS-innstillingene dine, og</li>\n<li>appvinduet er ikke fokusert.</li>\n</ul>\n<hr>\n<h3 id="tilbakestill-skrivebordsapplagring-siste-utvei"><a href="#tilbakestill-skrivebordsapplagring-siste-utvei">Tilbakestill skrivebordsapplagring (siste utvei)</a></h3>\n<p>Hvis appen ikke starter og du ikke kan slette innstillingene fra UI-et, tilbakestill skrivebordsappens lagrede tilstand.</p>\n<ol>\n<li>Avslutt SlopCode Desktop.</li>\n<li>Finn og slett disse filene (de finnes i SlopCode Desktop-appens datakatalog):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (stasjonær standardserver URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> og <code dir="auto">slopcode.workspace.*.dat</code> (UI tilstand som nylige servere/prosjekter)</li>\n</ul>\n<hr>\n<h3 id="modellen-er-ikke-tilgjengelig"><a href="#modellen-er-ikke-tilgjengelig">Modellen er ikke tilgjengelig</a></h3>\n<ol>\n<li>Sjekk at du har autentisert deg med leverandøren</li>\n<li>Kontroller at modellnavnet i konfigurasjonen er riktig</li>\n<li>Noen modeller kan kreve spesifikk tilgang eller abonnement</li>\n</ol>\n<p>Hvis du støter på <code dir="auto">ProviderModelNotFoundError</code> refererer du mest sannsynlig feil\ntil en modell et sted.\nModeller skal refereres slik: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<hr>\n<h3 id="ai_apicallerror-og-leverandørpakkeproblemer"><a href="#ai_apicallerror-og-leverandørpakkeproblemer">AI_APICallError og leverandørpakkeproblemer</a></h3>\n<p>Hvis du støter på API-anropsfeil, kan dette skyldes utdaterte provider-pakker. SlopCode installerer dynamisk provider-pakker (OpenAI, Anthropic, Google, etc.) etter behov og cacher dem lokalt.</p>\n<p>For å løse problemer med leverandørpakke:</p>\n<ol>\n<li>\n<p>Tøm leverandørens pakkebuffer:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>På Windows, trykk <code dir="auto">WIN+R</code> og slett: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Start SlopCode på nytt for å installere de nyeste provider-pakkene på nytt</p>\n</li>\n</ol>\n<p>Dette vil tvinge SlopCode til å laste ned de nyeste versjonene av provider-pakkene, som ofte løser kompatibilitetsproblemer med modellparametere og API-endringer.</p>\n<hr>\n<h3 id="kopierlim-inn-fungerer-ikke-på-linux"><a href="#kopierlim-inn-fungerer-ikke-på-linux">Kopier/lim inn fungerer ikke på Linux</a></h3>\n<p>Linux-brukere må ha ett av følgende utklippstavle-verktøy installert for at kopier/lim inn-funksjonalitet skal fungere:</p>\n<p><strong>For X11-systemer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>For Wayland-systemer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>For headless-miljøer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>SlopCode vil oppdage om du bruker Wayland og foretrekker <code dir="auto">wl-clipboard</code>, ellers vil den prøve å finne utklippstavle-verktøy i rekkefølgen: <code dir="auto">xclip</code> og <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/nb/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/nb/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/nb/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
