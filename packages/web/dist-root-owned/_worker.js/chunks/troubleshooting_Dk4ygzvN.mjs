globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Fejlfinding",
  description: "Almindelige problemer, og hvordan de løses.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "logfiler",
      text: "Logfiler",
    },
    {
      depth: 2,
      slug: "lagring",
      text: "Lagring",
    },
    {
      depth: 2,
      slug: "desktop-app",
      text: "Desktop-app",
    },
    {
      depth: 3,
      slug: "hurtige-tjek",
      text: "Hurtige tjek",
    },
    {
      depth: 3,
      slug: "deaktiver-plugins",
      text: "Deaktiver plugins",
    },
    {
      depth: 4,
      slug: "tjek-den-globale-konfiguration",
      text: "Tjek den globale konfiguration",
    },
    {
      depth: 4,
      slug: "tjek-plugin-mapper",
      text: "Tjek plugin-mapper",
    },
    {
      depth: 3,
      slug: "ryd-cachen",
      text: "Ryd cachen",
    },
    {
      depth: 3,
      slug: "løs-problemer-med-serverforbindelse",
      text: "Løs problemer med serverforbindelse",
    },
    {
      depth: 4,
      slug: "slet-standardserveren-for-skrivebordet-url",
      text: "Slet standardserveren for skrivebordet URL",
    },
    {
      depth: 4,
      slug: "fjern-serverport--serverhostname-fra-din-konfiguration",
      text: "Fjern server.port / server.hostname fra din konfiguration",
    },
    {
      depth: 4,
      slug: "tjek-miljøvariabler",
      text: "Tjek miljøvariabler",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-problemer",
      text: "Linux: Wayland / X11-problemer",
    },
    {
      depth: 3,
      slug: "windows-webview2-runtime",
      text: "Windows: WebView2-runtime",
    },
    {
      depth: 3,
      slug: "windows-generelle-ydeevneproblemer",
      text: "Windows: Generelle ydeevneproblemer",
    },
    {
      depth: 3,
      slug: "meddelelser-vises-ikke",
      text: "Meddelelser vises ikke",
    },
    {
      depth: 3,
      slug: "nulstil-desktop-applagring-sidste-udvej",
      text: "Nulstil desktop-applagring (sidste udvej)",
    },
    {
      depth: 2,
      slug: "få-hjælp",
      text: "Få hjælp",
    },
    {
      depth: 2,
      slug: "almindelige-problemer",
      text: "Almindelige problemer",
    },
    {
      depth: 3,
      slug: "slopcode-vil-ikke-starte",
      text: "SlopCode vil ikke starte",
    },
    {
      depth: 3,
      slug: "godkendelsesproblemer",
      text: "Godkendelsesproblemer",
    },
    {
      depth: 3,
      slug: "modellen-er-ikke-tilgængelig",
      text: "Modellen er ikke tilgængelig",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-og-udbyderpakkeproblemer",
      text: "AI_APICallError og udbyderpakkeproblemer",
    },
    {
      depth: 3,
      slug: "kopierindsæt-virker-ikke-på-linux",
      text: "Kopier/indsæt virker ikke på Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>For at fejlfinde problemer med SlopCode, start med at tjekke logfilerne og de lokale data, den gemmer på disken.</p>\n<hr>\n<h2 id="logfiler"><a href="#logfiler">Logfiler</a></h2>\n<p>Logfiler skrives til:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> og indsæt <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Logfiler navngives med tidsstempler (f.eks. <code dir="auto">2025-01-09T123456.log</code>) og de sidste 10 logfiler beholdes.</p>\n<p>Du kan angive logniveauet med kommandolinjeflaget <code dir="auto">--log-level</code> for at få mere detaljeret fejlfindingsinformation. For eksempel <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="lagring"><a href="#lagring">Lagring</a></h2>\n<p>slopcode gemmer sessionsdata og andre applikationsdata på disken på:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> og indsæt <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Denne mappe indeholder:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Godkendelsesdata som API-nøgler, OAuth-tokens</li>\n<li><code dir="auto">log/</code> - Applikationslogs</li>\n<li><code dir="auto">project/</code> - Projektspecifikke data som sessions- og beskeddata\n<ul>\n<li>Hvis projektet er inden for et Git-repo, gemmes det i <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Hvis det ikke er et Git-repo, gemmes det i <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="desktop-app"><a href="#desktop-app">Desktop-app</a></h2>\n<p>SlopCode Desktop kører en lokal SlopCode-server (<code dir="auto">slopcode-cli</code> sidevognen) i baggrunden. De fleste problemer er forårsaget af et plugin, der fungerer dårligt, en ødelagt cache eller en dårlig serverindstilling.</p>\n<h3 id="hurtige-tjek"><a href="#hurtige-tjek">Hurtige tjek</a></h3>\n<ul>\n<li>Afslut og start appen på ny.</li>\n<li>Hvis appen viser en fejlskærm, klikker du på <strong>Start på ny</strong> og kopierer fejldetaljerne.</li>\n<li>Kun macOS: <code dir="auto">SlopCode</code>-menu -> <strong>Genindlæs webvisning</strong> (hjælper hvis UI er tom/frosset).</li>\n</ul>\n<hr>\n<h3 id="deaktiver-plugins"><a href="#deaktiver-plugins">Deaktiver plugins</a></h3>\n<p>Hvis skrivebordsappen går ned ved opstart, hænger eller opfører sig mærkeligt, start med at deaktivere plugins.</p>\n<h4 id="tjek-den-globale-konfiguration"><a href="#tjek-den-globale-konfiguration">Tjek den globale konfiguration</a></h4>\n<p>Åbn den globale konfigurationsfil og se efter en <code dir="auto">plugin</code>-nøgle.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (eller <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (ældre installationer): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> og indsæt <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Hvis du har konfigureret plugins, deaktiver dem midlertidigt ved at fjerne nøglen eller sætte den til et tomt array:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="tjek-plugin-mapper"><a href="#tjek-plugin-mapper">Tjek plugin-mapper</a></h4>\n<p>SlopCode kan også indlæse lokale plugins fra disken. Flyt disse midlertidigt væk (eller giv mappen nyt navn) og start skrivebordsappen på ny:</p>\n<ul>\n<li><strong>Globale plugins</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> og indsæt <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Projektplugins</strong> (kun hvis du bruger konfiguration per projekt)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Hvis appen begynder at fungere igen, aktiverer du plugins én ad gangen for at finde ud af, hvilken som forårsager problemet.</p>\n<hr>\n<h3 id="ryd-cachen"><a href="#ryd-cachen">Ryd cachen</a></h3>\n<p>Hvis deaktivering af plugins ikke hjælper (eller en plugin-installation sidder fast), tøm cachen så SlopCode kan genopbygge den.</p>\n<ol>\n<li>Afslut SlopCode Desktop helt.</li>\n<li>Slet cache-mappen:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> indsæt <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: slet <code dir="auto">~/.cache/slopcode</code> (eller kør <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> og indsæt <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Start SlopCode Desktop på ny.</li>\n</ol>\n<hr>\n<h3 id="løs-problemer-med-serverforbindelse"><a href="#løs-problemer-med-serverforbindelse">Løs problemer med serverforbindelse</a></h3>\n<p>SlopCode Desktop kan enten starte sin egen lokale server (standard) eller forbinde til en server URL, du har konfigureret.</p>\n<p>Hvis du ser en <strong>“Forbindelse mislykkedes”</strong>-dialogboks (eller appen kommer aldrig forbi splash-skærmen), se efter en brugerdefineret server URL.</p>\n<h4 id="slet-standardserveren-for-skrivebordet-url"><a href="#slet-standardserveren-for-skrivebordet-url">Slet standardserveren for skrivebordet URL</a></h4>\n<p>Fra startskærmen klikker du på servernavnet (med statusprikken) for at åbne servervælgeren. I delen <strong>Standardserver</strong> klikker du på <strong>Slet</strong>.</p>\n<h4 id="fjern-serverport--serverhostname-fra-din-konfiguration"><a href="#fjern-serverport--serverhostname-fra-din-konfiguration">Fjern <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> fra din konfiguration</a></h4>\n<p>Hvis <code dir="auto">slopcode.json(c)</code> indeholder en <code dir="auto">server</code>-del, fjern den midlertidigt og start skrivebordsappen på ny.</p>\n<h4 id="tjek-miljøvariabler"><a href="#tjek-miljøvariabler">Tjek miljøvariabler</a></h4>\n<p>Hvis du har <code dir="auto">SLOPCODE_PORT</code> sat i dit miljø, vil skrivebordsappen prøve at bruge den port for den lokale server.</p>\n<ul>\n<li>Deaktiver <code dir="auto">SLOPCODE_PORT</code> (eller vælg en ledig port) og start på ny.</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-problemer"><a href="#linux-wayland--x11-problemer">Linux: Wayland / X11-problemer</a></h3>\n<p>På Linux kan nogle Wayland-opsætninger forårsage tomme vinduer eller kompositorfejl.</p>\n<ul>\n<li>Hvis du er på Wayland og appen er tom/crasher, prøv at starte med <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Hvis det gør ting værre, fjern det og prøv at starte under en X11-session i stedet.</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-runtime"><a href="#windows-webview2-runtime">Windows: WebView2-runtime</a></h3>\n<p>På Windows kræver SlopCode Desktop Microsoft Edge <strong>WebView2 Runtime</strong>. Hvis appen åbnes i et tomt vindue eller ikke starter, installer/opdater WebView2 og prøv igen.</p>\n<hr>\n<h3 id="windows-generelle-ydeevneproblemer"><a href="#windows-generelle-ydeevneproblemer">Windows: Generelle ydeevneproblemer</a></h3>\n<p>Hvis du oplever langsom ydeevne, problemer med filadgang eller terminalproblemer på Windows, kan du prøve at bruge <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>. WSL giver et Linux-miljø som fungerer mere sømløst med funktionerne i SlopCode.</p>\n<hr>\n<h3 id="meddelelser-vises-ikke"><a href="#meddelelser-vises-ikke">Meddelelser vises ikke</a></h3>\n<p>SlopCode Desktop viser kun systemvarsler når:</p>\n<ul>\n<li>varsler er aktiveret for SlopCode i dine OS-indstillinger, og</li>\n<li>appvinduet ikke er fokuseret.</li>\n</ul>\n<hr>\n<h3 id="nulstil-desktop-applagring-sidste-udvej"><a href="#nulstil-desktop-applagring-sidste-udvej">Nulstil desktop-applagring (sidste udvej)</a></h3>\n<p>Hvis appen ikke starter og du ikke kan slette indstillingerne fra UI, nulstil skrivebordsappens gemte tilstand.</p>\n<ol>\n<li>Afslut SlopCode Desktop.</li>\n<li>Find og slet disse filer (de findes i SlopCode Desktop-appens datamappe):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (skrivebordsstandardserver URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> og <code dir="auto">slopcode.workspace.*.dat</code> (UI tilstand som nylige servere/projekter)</li>\n</ul>\n<p>Sådan finder du mappen hurtigt:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (søg derefter efter filnavnene ovenfor)</li>\n<li><strong>Linux</strong>: søg under <code dir="auto">~/.local/share</code> efter filnavnene ovenfor</li>\n<li><strong>Windows</strong>: Tryk <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (søg derefter efter filnavnene ovenfor)</li>\n</ul>\n<hr>\n<h2 id="få-hjælp"><a href="#få-hjælp">Få hjælp</a></h2>\n<p>Hvis du oplever problemer med SlopCode:</p>\n<ol>\n<li>\n<p><strong>Rapporter problemer på GitHub</strong></p>\n<p>Den bedste måde at rapportere fejl eller bede om funktioner på er gennem vores GitHub-repo:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Før du opretter et nyt issue, søg i eksisterende issues for at se om dit problem allerede er rapporteret.</p>\n</li>\n<li>\n<p><strong>Bliv en del af vores Discord</strong></p>\n<p>For hjælp i realtid og fællesskabsdiskussion, bliv en del af vores Discord-server:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="almindelige-problemer"><a href="#almindelige-problemer">Almindelige problemer</a></h2>\n<p>Her er nogle almindelige problemer og hvordan du kan løse dem.</p>\n<hr>\n<h3 id="slopcode-vil-ikke-starte"><a href="#slopcode-vil-ikke-starte">SlopCode vil ikke starte</a></h3>\n<ol>\n<li>Tjek logfilerne for fejlmeddelelser</li>\n<li>Prøv at køre med <code dir="auto">--print-logs</code> for at se output i terminalen</li>\n<li>Sørg for at du har den nyeste version med <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="godkendelsesproblemer"><a href="#godkendelsesproblemer">Godkendelsesproblemer</a></h3>\n<ol>\n<li>Prøv at godkende på ny med kommandoen <code dir="auto">/connect</code> i TUI</li>\n<li>Tjek at dine API-nøgler er gyldige</li>\n<li>Sørg for at dit netværk tillader forbindelser til udbyderens API</li>\n</ol>\n<hr>\n<h3 id="modellen-er-ikke-tilgængelig"><a href="#modellen-er-ikke-tilgængelig">Modellen er ikke tilgængelig</a></h3>\n<ol>\n<li>Tjek at du har godkendt dig med udbyderen</li>\n<li>Kontroller at modelnavnet i konfigurationen er rigtigt</li>\n<li>Nogle modeller kan kræve specifik adgang eller abonnement</li>\n</ol>\n<p>Hvis du støder på <code dir="auto">ProviderModelNotFoundError</code> refererer du mest sandsynligt forkert\ntil en model et sted.\nModeller skal refereres sådan: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Eksempler:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>For at finde ud af hvilke modeller du har adgang til, kør <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Hvis du støder på en ProviderInitError, har du sandsynligvis en ugyldig eller ødelagt konfiguration.</p>\n<p>For at løse dette:</p>\n<ol>\n<li>\n<p>Kontroller først at din udbyder er rigtigt konfigureret ved at følge <a href="/docs/providers">udbydervejledningen</a></p>\n</li>\n<li>\n<p>Hvis problemet vedvarer, prøv at tømme den gemte konfiguration:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>På Windows, tryk <code dir="auto">WIN+R</code> og slet: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Godkend på ny med din udbyder ved at bruge kommandoen <code dir="auto">/connect</code> i TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-og-udbyderpakkeproblemer"><a href="#ai_apicallerror-og-udbyderpakkeproblemer">AI_APICallError og udbyderpakkeproblemer</a></h3>\n<p>Hvis du støder på API-kaldsfejl, kan dette skyldes forældede udbyderpakker. slopcode installerer dynamisk udbyderpakker (OpenAI, Anthropic, Google, etc.) efter behov og cacher dem lokalt.</p>\n<p>For at løse problemer med udbyderpakke:</p>\n<ol>\n<li>\n<p>Tøm udbyderens pakkecache:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>På Windows, tryk <code dir="auto">WIN+R</code> og slet: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Start slopcode på ny for at installere de nyeste udbyderpakker på ny</p>\n</li>\n</ol>\n<p>Dette vil tvinge slopcode til at downloade de nyeste versioner af udbyderpakkerne, som ofte løser kompatibilitetsproblemer med modelparametre og API-ændringer.</p>\n<hr>\n<h3 id="kopierindsæt-virker-ikke-på-linux"><a href="#kopierindsæt-virker-ikke-på-linux">Kopier/indsæt virker ikke på Linux</a></h3>\n<p>Linux-brugere skal have et af følgende udklipsholderværktøjer installeret for at kopier/indsæt-funktionalitet skal fungere:</p>\n<p><strong>For X11-systemer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>For Wayland-systemer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>For hovedløse miljøer:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode vil opdage om du bruger Wayland og foretrække <code dir="auto">wl-clipboard</code>, ellers vil den prøve at finde udklipsholderværktøjer i rækkefølgen: <code dir="auto">xclip</code> og <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/da/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/da/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
