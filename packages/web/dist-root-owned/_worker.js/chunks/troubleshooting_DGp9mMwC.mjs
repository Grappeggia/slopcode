globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Risoluzione dei problemi",
  description: "Problemi comuni e come risolverli.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "log",
      text: "Log",
    },
    {
      depth: 2,
      slug: "archiviazione",
      text: "Archiviazione",
    },
    {
      depth: 2,
      slug: "app-desktop",
      text: "App desktop",
    },
    {
      depth: 3,
      slug: "controlli-rapidi",
      text: "Controlli rapidi",
    },
    {
      depth: 3,
      slug: "disabilita-i-plugin",
      text: "Disabilita i plugin",
    },
    {
      depth: 4,
      slug: "controlla-la-configurazione-globale",
      text: "Controlla la configurazione globale",
    },
    {
      depth: 4,
      slug: "controlla-le-directory-dei-plugin",
      text: "Controlla le directory dei plugin",
    },
    {
      depth: 3,
      slug: "svuota-la-cache",
      text: "Svuota la cache",
    },
    {
      depth: 3,
      slug: "risolvi-problemi-di-connessione-al-server",
      text: "Risolvi problemi di connessione al server",
    },
    {
      depth: 4,
      slug: "cancella-lurl-del-server-predefinito-dellapp-desktop",
      text: "Cancella l’URL del server predefinito dell’app desktop",
    },
    {
      depth: 4,
      slug: "rimuovi-serverport--serverhostname-dalla-tua-configurazione",
      text: "Rimuovi server.port / server.hostname dalla tua configurazione",
    },
    {
      depth: 4,
      slug: "controlla-le-variabili-dambiente",
      text: "Controlla le variabili d’ambiente",
    },
    {
      depth: 3,
      slug: "linux-problemi-wayland--x11",
      text: "Linux: problemi Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-runtime-webview2",
      text: "Windows: runtime WebView2",
    },
    {
      depth: 3,
      slug: "windows-problemi-generali-di-prestazioni",
      text: "Windows: problemi generali di prestazioni",
    },
    {
      depth: 3,
      slug: "notifiche-non-visualizzate",
      text: "Notifiche non visualizzate",
    },
    {
      depth: 3,
      slug: "reimposta-lo-stato-dellapp-desktop-ultima-risorsa",
      text: "Reimposta lo stato dell’app desktop (ultima risorsa)",
    },
    {
      depth: 2,
      slug: "ottenere-aiuto",
      text: "Ottenere aiuto",
    },
    {
      depth: 2,
      slug: "problemi-comuni",
      text: "Problemi comuni",
    },
    {
      depth: 3,
      slug: "slopcode-non-si-avvia",
      text: "SlopCode non si avvia",
    },
    {
      depth: 3,
      slug: "problemi-di-autenticazione",
      text: "Problemi di autenticazione",
    },
    {
      depth: 3,
      slug: "modello-non-disponibile",
      text: "Modello non disponibile",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-e-problemi-dei-pacchetti-provider",
      text: "AI_APICallError e problemi dei pacchetti provider",
    },
    {
      depth: 3,
      slug: "copiaincolla-non-funziona-su-linux",
      text: "Copia/incolla non funziona su Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Per diagnosticare problemi con SlopCode, inizia controllando i log e i dati locali che salva su disco.</p>\n<hr>\n<h2 id="log"><a href="#log">Log</a></h2>\n<p>I file di log vengono scritti in:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> e incolla <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>I file di log hanno nomi con timestamp (ad es. <code dir="auto">2025-01-09T123456.log</code>) e vengono conservati i 10 file di log piu recenti.</p>\n<p>Puoi impostare il livello di log con l’opzione a riga di comando <code dir="auto">--log-level</code> per ottenere informazioni di debug piu dettagliate. Per esempio: <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="archiviazione"><a href="#archiviazione">Archiviazione</a></h2>\n<p>slopcode salva i dati delle sessioni e altri dati dell’applicazione su disco in:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> e incolla <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Questa directory contiene:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - dati di autenticazione come chiavi API, token OAuth</li>\n<li><code dir="auto">log/</code> - log dell’applicazione</li>\n<li><code dir="auto">project/</code> - dati specifici del progetto come dati di sessione e messaggi\n<ul>\n<li>Se il progetto e dentro un repository Git, viene salvato in <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Se non e un repository Git, viene salvato in <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="app-desktop"><a href="#app-desktop">App desktop</a></h2>\n<p>SlopCode Desktop esegue in background un server locale di SlopCode (il sidecar <code dir="auto">slopcode-cli</code>). La maggior parte dei problemi e causata da un plugin che si comporta male, da una cache corrotta o da un’impostazione del server errata.</p>\n<h3 id="controlli-rapidi"><a href="#controlli-rapidi">Controlli rapidi</a></h3>\n<ul>\n<li>Chiudi completamente l’app e riaprila.</li>\n<li>Se l’app mostra una schermata di errore, fai clic su <strong>Restart</strong> e copia i dettagli dell’errore.</li>\n<li>Solo macOS: menu <code dir="auto">SlopCode</code> -> <strong>Reload Webview</strong> (utile se l’interfaccia e vuota o bloccata).</li>\n</ul>\n<hr>\n<h3 id="disabilita-i-plugin"><a href="#disabilita-i-plugin">Disabilita i plugin</a></h3>\n<p>Se l’app desktop va in crash all’avvio, si blocca o si comporta in modo strano, inizia disabilitando i plugin.</p>\n<h4 id="controlla-la-configurazione-globale"><a href="#controlla-la-configurazione-globale">Controlla la configurazione globale</a></h4>\n<p>Apri il tuo file di configurazione globale e cerca la chiave <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (or <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (older installs): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> e incolla <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Se hai plugin configurati, disabilitali temporaneamente rimuovendo la chiave o impostandola a un array vuoto:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="controlla-le-directory-dei-plugin"><a href="#controlla-le-directory-dei-plugin">Controlla le directory dei plugin</a></h4>\n<p>SlopCode puo anche caricare plugin locali dal disco. Spostali temporaneamente altrove (o rinomina la cartella) e riavvia l’app desktop:</p>\n<ul>\n<li><strong>Plugin globali</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n</ul>\n</li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> e incolla <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n<li><strong>Plugin del progetto</strong> (solo se usi una configurazione per progetto)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Se l’app ricomincia a funzionare, riabilita i plugin uno alla volta per capire quale stia causando il problema.</p>\n<hr>\n<h3 id="svuota-la-cache"><a href="#svuota-la-cache">Svuota la cache</a></h3>\n<p>Se disabilitare i plugin non aiuta (o l’installazione di un plugin e bloccata), svuota la cache in modo che SlopCode possa ricostruirla.</p>\n<ol>\n<li>Quit SlopCode Desktop completely.</li>\n<li>Elimina la directory della cache:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> paste <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: elimina <code dir="auto">~/.cache/slopcode</code> (oppure esegui <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> e incolla <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Restart SlopCode Desktop.</li>\n</ol>\n<hr>\n<h3 id="risolvi-problemi-di-connessione-al-server"><a href="#risolvi-problemi-di-connessione-al-server">Risolvi problemi di connessione al server</a></h3>\n<p>SlopCode Desktop puo avviare il proprio server locale (predefinito) oppure connettersi a un URL server che hai configurato.</p>\n<p>Se vedi una finestra <strong>“Connection Failed”</strong> (o l’app non supera mai la schermata di avvio), controlla se hai impostato un URL server personalizzato.</p>\n<h4 id="cancella-lurl-del-server-predefinito-dellapp-desktop"><a href="#cancella-lurl-del-server-predefinito-dellapp-desktop">Cancella l’URL del server predefinito dell’app desktop</a></h4>\n<p>Dalla schermata Home, fai clic sul nome del server (con il pallino di stato) per aprire il selettore dei server. Nella sezione <strong>Default server</strong>, fai clic su <strong>Clear</strong>.</p>\n<h4 id="rimuovi-serverport--serverhostname-dalla-tua-configurazione"><a href="#rimuovi-serverport--serverhostname-dalla-tua-configurazione">Rimuovi <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> dalla tua configurazione</a></h4>\n<p>Se il tuo <code dir="auto">slopcode.json(c)</code> contiene una sezione <code dir="auto">server</code>, rimuovila temporaneamente e riavvia l’app desktop.</p>\n<h4 id="controlla-le-variabili-dambiente"><a href="#controlla-le-variabili-dambiente">Controlla le variabili d’ambiente</a></h4>\n<p>Se hai <code dir="auto">SLOPCODE_PORT</code> impostato nell’ambiente, l’app desktop provera a usare quella porta per il server locale.</p>\n<ul>\n<li>Rimuovi <code dir="auto">SLOPCODE_PORT</code> (o scegli una porta libera) e riavvia.</li>\n</ul>\n<hr>\n<h3 id="linux-problemi-wayland--x11"><a href="#linux-problemi-wayland--x11">Linux: problemi Wayland / X11</a></h3>\n<p>Su Linux, alcune configurazioni Wayland possono causare finestre vuote o errori del compositor.</p>\n<ul>\n<li>Se sei su Wayland e l’app e vuota o va in crash, prova ad avviarla con <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Se peggiora la situazione, rimuovilo e prova invece ad avviare sotto una sessione X11.</li>\n</ul>\n<hr>\n<h3 id="windows-runtime-webview2"><a href="#windows-runtime-webview2">Windows: runtime WebView2</a></h3>\n<p>Su Windows, SlopCode Desktop richiede <strong>WebView2 Runtime</strong> di Microsoft Edge. Se l’app si apre su una finestra vuota o non parte, installa/aggiorna WebView2 e riprova.</p>\n<hr>\n<h3 id="windows-problemi-generali-di-prestazioni"><a href="#windows-problemi-generali-di-prestazioni">Windows: problemi generali di prestazioni</a></h3>\n<p>Se riscontri prestazioni lente, problemi di accesso ai file o problemi del terminale su Windows, prova a usare <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>. WSL fornisce un ambiente Linux che funziona in modo piu fluido con le funzionalita di SlopCode.</p>\n<hr>\n<h3 id="notifiche-non-visualizzate"><a href="#notifiche-non-visualizzate">Notifiche non visualizzate</a></h3>\n<p>SlopCode Desktop mostra le notifiche di sistema solo quando:</p>\n<ul>\n<li>le notifiche sono abilitate per SlopCode nelle impostazioni del sistema operativo, e</li>\n<li>la finestra dell’app non e in primo piano.</li>\n</ul>\n<hr>\n<h3 id="reimposta-lo-stato-dellapp-desktop-ultima-risorsa"><a href="#reimposta-lo-stato-dellapp-desktop-ultima-risorsa">Reimposta lo stato dell’app desktop (ultima risorsa)</a></h3>\n<p>Se l’app non si avvia e non riesci a ripulire le impostazioni dall’interfaccia, reimposta lo stato salvato dell’app desktop.</p>\n<ol>\n<li>Quit SlopCode Desktop.</li>\n<li>Trova ed elimina questi file (si trovano nella directory dati dell’app SlopCode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (desktop default server URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> e <code dir="auto">slopcode.workspace.*.dat</code> (stato dell’interfaccia come server/progetti recenti)</li>\n</ul>\n<p>Per trovare rapidamente la directory:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (poi cerca i nomi file qui sopra)</li>\n<li><strong>Linux</strong>: cerca sotto <code dir="auto">~/.local/share</code> i nomi file qui sopra</li>\n<li><strong>Windows</strong>: premi <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (poi cerca i nomi file qui sopra)</li>\n</ul>\n<hr>\n<h2 id="ottenere-aiuto"><a href="#ottenere-aiuto">Ottenere aiuto</a></h2>\n<p>Se riscontri problemi con SlopCode:</p>\n<ol>\n<li>\n<p><strong>Segnala i problemi su GitHub</strong></p>\n<p>Il modo migliore per segnalare bug o richiedere funzionalita e tramite il nostro repository GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Prima di creare una nuova issue, cerca tra quelle esistenti per vedere se il problema e gia stato segnalato.</p>\n</li>\n<li>\n<p><strong>Unisciti al nostro Discord</strong></p>\n<p>Per supporto in tempo reale e discussioni con la community, unisciti al nostro server Discord:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="problemi-comuni"><a href="#problemi-comuni">Problemi comuni</a></h2>\n<p>Ecco alcuni problemi comuni e come risolverli.</p>\n<hr>\n<h3 id="slopcode-non-si-avvia"><a href="#slopcode-non-si-avvia">SlopCode non si avvia</a></h3>\n<ol>\n<li>Controlla i log per eventuali messaggi di errore</li>\n<li>Prova a eseguire con <code dir="auto">--print-logs</code> per vedere l’output nel terminale</li>\n<li>Assicurati di avere l’ultima versione con <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problemi-di-autenticazione"><a href="#problemi-di-autenticazione">Problemi di autenticazione</a></h3>\n<ol>\n<li>Prova a riautenticarti con il comando <code dir="auto">/connect</code> nella TUI</li>\n<li>Controlla che le chiavi API siano valide</li>\n<li>Assicurati che la rete permetta connessioni all’API del provider</li>\n</ol>\n<hr>\n<h3 id="modello-non-disponibile"><a href="#modello-non-disponibile">Modello non disponibile</a></h3>\n<ol>\n<li>Controlla di esserti autenticato con il provider</li>\n<li>Verifica che il nome del modello nella configurazione sia corretto</li>\n<li>Alcuni modelli potrebbero richiedere accessi o abbonamenti specifici</li>\n</ol>\n<p>Se incontri <code dir="auto">ProviderModelNotFoundError</code>, probabilmente stai facendo riferimento a un modello in modo errato da qualche parte.\nI modelli vanno indicati in questo formato: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Esempi:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Per capire a quali modelli hai accesso, esegui <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Se incontri un ProviderInitError, probabilmente la tua configurazione e invalida o corrotta.</p>\n<p>Per risolvere:</p>\n<ol>\n<li>\n<p>Per prima cosa, verifica che il provider sia configurato correttamente seguendo la <a href="/docs/providers">guida ai provider</a></p>\n</li>\n<li>\n<p>Se il problema persiste, prova a cancellare la configurazione salvata:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>Su Windows, premi <code dir="auto">WIN+R</code> ed elimina: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Riautenticati con il provider usando il comando <code dir="auto">/connect</code> nella TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-e-problemi-dei-pacchetti-provider"><a href="#ai_apicallerror-e-problemi-dei-pacchetti-provider">AI_APICallError e problemi dei pacchetti provider</a></h3>\n<p>Se incontri errori nelle chiamate API, potrebbe dipendere da pacchetti provider non aggiornati. slopcode installa dinamicamente i pacchetti provider (OpenAI, Anthropic, Google, ecc.) quando servono e li mette in cache localmente.</p>\n<p>Per risolvere problemi coi pacchetti provider:</p>\n<ol>\n<li>\n<p>Svuota la cache dei pacchetti provider:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>Su Windows, premi <code dir="auto">WIN+R</code> ed elimina: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Riavvia slopcode per reinstallare i pacchetti provider piu recenti</p>\n</li>\n</ol>\n<p>Questo forzera slopcode a scaricare le versioni piu recenti dei pacchetti provider, cosa che spesso risolve problemi di compatibilita con parametri dei modelli e cambiamenti delle API.</p>\n<hr>\n<h3 id="copiaincolla-non-funziona-su-linux"><a href="#copiaincolla-non-funziona-su-linux">Copia/incolla non funziona su Linux</a></h3>\n<p>Su Linux e necessario avere installata una delle seguenti utility per gli appunti affinche copia/incolla funzioni:</p>\n<p><strong>Per sistemi X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Per sistemi Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Per ambienti headless:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode rilevera se stai usando Wayland e preferira <code dir="auto">wl-clipboard</code>; altrimenti provera a trovare gli strumenti per gli appunti nell’ordine: <code dir="auto">xclip</code> e <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/it/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/it/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
