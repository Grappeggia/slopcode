globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Fehlerbehebung",
  description: "Haeufige Probleme und schnelle Loesungen.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "logs",
      text: "Logs",
    },
    {
      depth: 2,
      slug: "speicher",
      text: "Speicher",
    },
    {
      depth: 2,
      slug: "desktop-app",
      text: "Desktop-App",
    },
    {
      depth: 3,
      slug: "schnellchecks",
      text: "Schnellchecks",
    },
    {
      depth: 3,
      slug: "plugins-deaktivieren",
      text: "Plugins deaktivieren",
    },
    {
      depth: 4,
      slug: "globale-konfiguration-prüfen",
      text: "Globale Konfiguration prüfen",
    },
    {
      depth: 4,
      slug: "plugin-verzeichnisse-prüfen",
      text: "Plugin-Verzeichnisse prüfen",
    },
    {
      depth: 3,
      slug: "cache-leeren",
      text: "Cache leeren",
    },
    {
      depth: 3,
      slug: "server-verbindungsprobleme-beheben",
      text: "Server-Verbindungsprobleme beheben",
    },
    {
      depth: 4,
      slug: "desktop-standard-server-url-löschen",
      text: "Desktop-Standard-Server-URL löschen",
    },
    {
      depth: 4,
      slug: "serverport--serverhostname-aus-konfiguration-entfernen",
      text: "server.port / server.hostname aus Konfiguration entfernen",
    },
    {
      depth: 4,
      slug: "umgebungsvariablen-prüfen",
      text: "Umgebungsvariablen prüfen",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-probleme",
      text: "Linux: Wayland / X11-Probleme",
    },
    {
      depth: 3,
      slug: "windows-webview2-laufzeit",
      text: "Windows: WebView2-Laufzeit",
    },
    {
      depth: 3,
      slug: "windows-allgemeine-performance-probleme",
      text: "Windows: Allgemeine Performance-Probleme",
    },
    {
      depth: 3,
      slug: "benachrichtigungen-werden-nicht-angezeigt",
      text: "Benachrichtigungen werden nicht angezeigt",
    },
    {
      depth: 3,
      slug: "desktop-app-speicher-zurücksetzen-letzter-ausweg",
      text: "Desktop-App-Speicher zurücksetzen (letzter Ausweg)",
    },
    {
      depth: 2,
      slug: "hilfe-bekommen",
      text: "Hilfe bekommen",
    },
    {
      depth: 2,
      slug: "haeufige-probleme",
      text: "Haeufige Probleme",
    },
    {
      depth: 3,
      slug: "slopcode-startet-nicht",
      text: "SlopCode startet nicht",
    },
    {
      depth: 3,
      slug: "authentifizierungsprobleme",
      text: "Authentifizierungsprobleme",
    },
    {
      depth: 3,
      slug: "modell-nicht-verfügbar",
      text: "Modell nicht verfügbar",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-und-provider-paket-probleme",
      text: "AI_APICallError und Provider-Paket-Probleme",
    },
    {
      depth: 3,
      slug: "copypaste-funktioniert-nicht-unter-linux",
      text: "Copy/Paste funktioniert nicht unter Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Wenn SlopCode Probleme macht, starte mit Logs und lokal gespeicherten Daten auf der Festplatte.</p>\n<hr>\n<h2 id="logs"><a href="#logs">Logs</a></h2>\n<p>Logdateien werden hier gespeichert:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> and paste <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Dateinamen enthalten Zeitstempel (z. B. <code dir="auto">2025-01-09T123456.log</code>) und es bleiben die letzten 10 Logs erhalten.</p>\n<p>Mit <code dir="auto">--log-level</code> bekommst du detailliertere Diagnoseinfos, z. B. <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="speicher"><a href="#speicher">Speicher</a></h2>\n<p>slopcode speichert Sitzungs- und App-Daten auf der Festplatte unter:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> and paste <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Dieses Verzeichnis enthaelt:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Authentifizierungsdaten wie API-Keys und OAuth-Tokens</li>\n<li><code dir="auto">log/</code> - Anwendungslogs</li>\n<li><code dir="auto">project/</code> - Projektspezifische Daten wie Sitzungen und Nachrichten\n<ul>\n<li>In Git-Repositories unter <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Ohne Git unter <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="desktop-app"><a href="#desktop-app">Desktop-App</a></h2>\n<p>SlopCode Desktop startet im Hintergrund einen lokalen SlopCode-Server (<code dir="auto">slopcode-cli</code>-Sidecar).\nViele Probleme kommen von fehlerhaften Plugins, kaputtem Cache oder falschen Server-Einstellungen.</p>\n<h3 id="schnellchecks"><a href="#schnellchecks">Schnellchecks</a></h3>\n<ul>\n<li>App komplett beenden und neu starten</li>\n<li>Bei Fehlerbildschirm <strong>Restart</strong> klicken und Details kopieren</li>\n<li>Nur macOS: <code dir="auto">SlopCode</code>-Menue -> <strong>Reload Webview</strong> (hilft bei leerer/eingefrorener UI)</li>\n</ul>\n<hr>\n<h3 id="plugins-deaktivieren"><a href="#plugins-deaktivieren">Plugins deaktivieren</a></h3>\n<p>If the desktop app is crashing on launch, hanging, or behaving strangely, start by disabling plugins.</p>\n<h4 id="globale-konfiguration-prüfen"><a href="#globale-konfiguration-prüfen">Globale Konfiguration prüfen</a></h4>\n<p>Open your global config file and look for a <code dir="auto">plugin</code> key.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (or <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (older installs): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> and paste <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>If you have plugins configured, temporarily disable them by removing the key or setting it to an empty array:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="plugin-verzeichnisse-prüfen"><a href="#plugin-verzeichnisse-prüfen">Plugin-Verzeichnisse prüfen</a></h4>\n<p>SlopCode can also load local plugins from disk. Temporarily move these out of the way (or rename the folder) and restart the desktop app:</p>\n<ul>\n<li><strong>Global plugins</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> and paste <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Project plugins</strong> (only if you use per-project config)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>If the app starts working again, re-enable plugins one at a time to find which one is causing the issue.</p>\n<hr>\n<h3 id="cache-leeren"><a href="#cache-leeren">Cache leeren</a></h3>\n<p>If disabling plugins doesn’t help (or a plugin install is stuck), clear the cache so SlopCode can rebuild it.</p>\n<ol>\n<li>Quit SlopCode Desktop completely.</li>\n<li>Delete the cache directory:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> paste <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: delete <code dir="auto">~/.cache/slopcode</code> (or run <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> and paste <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Restart SlopCode Desktop.</li>\n</ol>\n<hr>\n<h3 id="server-verbindungsprobleme-beheben"><a href="#server-verbindungsprobleme-beheben">Server-Verbindungsprobleme beheben</a></h3>\n<p>SlopCode Desktop can either start its own local server (default) or connect to a server URL you configured.</p>\n<p>If you see a <strong>“Connection Failed”</strong> dialog (or the app never gets past the splash screen), check for a custom server URL.</p>\n<h4 id="desktop-standard-server-url-löschen"><a href="#desktop-standard-server-url-löschen">Desktop-Standard-Server-URL löschen</a></h4>\n<p>From the Home screen, click the server name (with the status dot) to open the Server picker. In the <strong>Default server</strong> section, click <strong>Clear</strong>.</p>\n<h4 id="serverport--serverhostname-aus-konfiguration-entfernen"><a href="#serverport--serverhostname-aus-konfiguration-entfernen"><code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> aus Konfiguration entfernen</a></h4>\n<p>If your <code dir="auto">slopcode.json(c)</code> contains a <code dir="auto">server</code> section, temporarily remove it and restart the desktop app.</p>\n<h4 id="umgebungsvariablen-prüfen"><a href="#umgebungsvariablen-prüfen">Umgebungsvariablen prüfen</a></h4>\n<p>If you have <code dir="auto">SLOPCODE_PORT</code> set in your environment, the desktop app will try to use that port for the local server.</p>\n<ul>\n<li>Unset <code dir="auto">SLOPCODE_PORT</code> (or pick a free port) and restart.</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-probleme"><a href="#linux-wayland--x11-probleme">Linux: Wayland / X11-Probleme</a></h3>\n<p>On Linux, some Wayland setups can cause blank windows or compositor errors.</p>\n<ul>\n<li>If you’re on Wayland and the app is blank/crashing, try launching with <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>If that makes things worse, remove it and try launching under an X11 session instead.</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-laufzeit"><a href="#windows-webview2-laufzeit">Windows: WebView2-Laufzeit</a></h3>\n<p>On Windows, SlopCode Desktop requires the Microsoft Edge <strong>WebView2 Runtime</strong>. If the app opens to a blank window or won’t start, install/update WebView2 and try again.</p>\n<hr>\n<h3 id="windows-allgemeine-performance-probleme"><a href="#windows-allgemeine-performance-probleme">Windows: Allgemeine Performance-Probleme</a></h3>\n<p>If you’re experiencing slow performance, file access issues, or terminal problems on Windows, try using <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>. WSL provides a Linux environment that works more seamlessly with SlopCode’s features.</p>\n<hr>\n<h3 id="benachrichtigungen-werden-nicht-angezeigt"><a href="#benachrichtigungen-werden-nicht-angezeigt">Benachrichtigungen werden nicht angezeigt</a></h3>\n<p>SlopCode Desktop only shows system notifications when:</p>\n<ul>\n<li>notifications are enabled for SlopCode in your OS settings, and</li>\n<li>the app window is not focused.</li>\n</ul>\n<hr>\n<h3 id="desktop-app-speicher-zurücksetzen-letzter-ausweg"><a href="#desktop-app-speicher-zurücksetzen-letzter-ausweg">Desktop-App-Speicher zurücksetzen (letzter Ausweg)</a></h3>\n<p>If the app won’t start and you can’t clear settings from inside the UI, reset the desktop app’s saved state.</p>\n<ol>\n<li>Quit SlopCode Desktop.</li>\n<li>Find and delete these files (they live in the SlopCode Desktop app data directory):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (desktop default server URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> and <code dir="auto">slopcode.workspace.*.dat</code> (UI state like recent servers/projects)</li>\n</ul>\n<p>To find the directory quickly:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (then search for the filenames above)</li>\n<li><strong>Linux</strong>: search under <code dir="auto">~/.local/share</code> for the filenames above</li>\n<li><strong>Windows</strong>: Press <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (then search for the filenames above)</li>\n</ul>\n<hr>\n<h2 id="hilfe-bekommen"><a href="#hilfe-bekommen">Hilfe bekommen</a></h2>\n<p>Wenn du Probleme mit SlopCode hast:</p>\n<ol>\n<li>\n<p><strong>Probleme auf GitHub melden</strong></p>\n<p>Bugs und Feature-Wuensche meldest du am besten im GitHub-Repository:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Suche vor dem Erstellen nach bestehenden Issues, damit Duplikate vermieden werden.</p>\n</li>\n<li>\n<p><strong>Unserem Discord beitreten</strong></p>\n<p>Fuer schnelle Hilfe und Austausch in der Community:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="haeufige-probleme"><a href="#haeufige-probleme">Haeufige Probleme</a></h2>\n<p>Hier sind typische Fehlerbilder und wie du sie loest.</p>\n<hr>\n<h3 id="slopcode-startet-nicht"><a href="#slopcode-startet-nicht">SlopCode startet nicht</a></h3>\n<ol>\n<li>Check the logs for error messages</li>\n<li>Try running with <code dir="auto">--print-logs</code> to see output in the terminal</li>\n<li>Ensure you have the latest version with <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="authentifizierungsprobleme"><a href="#authentifizierungsprobleme">Authentifizierungsprobleme</a></h3>\n<ol>\n<li>Try re-authenticating with the <code dir="auto">/connect</code> command in the TUI</li>\n<li>Check that your API keys are valid</li>\n<li>Ensure your network allows connections to the provider’s API</li>\n</ol>\n<hr>\n<h3 id="modell-nicht-verfügbar"><a href="#modell-nicht-verfügbar">Modell nicht verfügbar</a></h3>\n<ol>\n<li>Check that you’ve authenticated with the provider</li>\n<li>Verify the model name in your config is correct</li>\n<li>Some models may require specific access or subscriptions</li>\n</ol>\n<p>If you encounter <code dir="auto">ProviderModelNotFoundError</code> you are most likely incorrectly\nreferencing a model somewhere.\nModels should be referenced like so: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Examples:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>To figure out what models you have access to, run <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>If you encounter a ProviderInitError, you likely have an invalid or corrupted configuration.</p>\n<p>To resolve this:</p>\n<ol>\n<li>\n<p>First, verify your provider is set up correctly by following the <a href="/docs/providers">providers guide</a></p>\n</li>\n<li>\n<p>If the issue persists, try clearing your stored configuration:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>On Windows, press <code dir="auto">WIN+R</code> and delete: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Re-authenticate with your provider using the <code dir="auto">/connect</code> command in the TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-und-provider-paket-probleme"><a href="#ai_apicallerror-und-provider-paket-probleme">AI_APICallError und Provider-Paket-Probleme</a></h3>\n<p>If you encounter API call errors, this may be due to outdated provider packages. slopcode dynamically installs provider packages (OpenAI, Anthropic, Google, etc.) as needed and caches them locally.</p>\n<p>To resolve provider package issues:</p>\n<ol>\n<li>\n<p>Clear the provider package cache:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>On Windows, press <code dir="auto">WIN+R</code> and delete: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Restart slopcode to reinstall the latest provider packages</p>\n</li>\n</ol>\n<p>This will force slopcode to download the most recent versions of provider packages, which often resolves compatibility issues with model parameters and API changes.</p>\n<hr>\n<h3 id="copypaste-funktioniert-nicht-unter-linux"><a href="#copypaste-funktioniert-nicht-unter-linux">Copy/Paste funktioniert nicht unter Linux</a></h3>\n<p>Linux users need to have one of the following clipboard utilities installed for copy/paste functionality to work:</p>\n<p><strong>For X11 systems:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>For Wayland systems:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>For headless environments:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode will detect if you’re using Wayland and prefer <code dir="auto">wl-clipboard</code>, otherwise it will try to find clipboard tools in order of: <code dir="auto">xclip</code> and <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/de/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/de/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/de/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
