globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Rješavanje problema",
  description: "Uobičajeni problemi i kako ih riješiti.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "dnevnici",
      text: "Dnevnici",
    },
    {
      depth: 2,
      slug: "pohrana",
      text: "Pohrana",
    },
    {
      depth: 2,
      slug: "desktop-aplikacija",
      text: "Desktop aplikacija",
    },
    {
      depth: 3,
      slug: "brze-provjere",
      text: "Brze provjere",
    },
    {
      depth: 3,
      slug: "onemogućavanje-dodataka",
      text: "Onemogućavanje dodataka",
    },
    {
      depth: 4,
      slug: "provjerite-globalnu-konfiguraciju",
      text: "Provjerite globalnu konfiguraciju",
    },
    {
      depth: 4,
      slug: "provjera-direktorija-dodataka",
      text: "Provjera direktorija dodataka",
    },
    {
      depth: 3,
      slug: "brisanje-keš-memorije",
      text: "Brisanje keš memorije",
    },
    {
      depth: 3,
      slug: "rješavanje-problema-sa-vezom-na-serveru",
      text: "Rješavanje problema sa vezom na serveru",
    },
    {
      depth: 4,
      slug: "obrišite-zadani-url-servera-radne-površine",
      text: "Obrišite zadani URL servera radne površine",
    },
    {
      depth: 4,
      slug: "uklonite-serverport--serverhostname-iz-vaše-konfiguracije",
      text: "Uklonite server.port / server.hostname iz vaše konfiguracije",
    },
    {
      depth: 4,
      slug: "provjerite-varijable-okruženja",
      text: "Provjerite varijable okruženja",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-problemi",
      text: "Linux: Wayland / X11 problemi",
    },
    {
      depth: 3,
      slug: "windows-webview2-izvršno-okruženje",
      text: "Windows: WebView2 izvršno okruženje",
    },
    {
      depth: 3,
      slug: "windows-opšti-problemi-sa-performansama",
      text: "Windows: Opšti problemi sa performansama",
    },
    {
      depth: 3,
      slug: "obavještenja-se-ne-prikazuju",
      text: "Obavještenja se ne prikazuju",
    },
    {
      depth: 3,
      slug: "resetovanje-pohrane-desktop-aplikacije",
      text: "Resetovanje pohrane desktop aplikacije",
    },
    {
      depth: 2,
      slug: "traženje-pomoći",
      text: "Traženje pomoći",
    },
    {
      depth: 2,
      slug: "uobičajeni-problemi",
      text: "Uobičajeni problemi",
    },
    {
      depth: 3,
      slug: "slopcode-se-ne-pokreće",
      text: "SlopCode se ne pokreće",
    },
    {
      depth: 3,
      slug: "problemi-s-autentifikacijom",
      text: "Problemi s autentifikacijom",
    },
    {
      depth: 3,
      slug: "model-nije-dostupan",
      text: "Model nije dostupan",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-i-problemi-sa-paketom-dobavljača",
      text: "AI_APICallError i problemi sa paketom dobavljača",
    },
    {
      depth: 3,
      slug: "copypaste-ne-radi-na-linuxu",
      text: "Copy/paste ne radi na Linuxu",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Da biste otklonili probleme s SlopCode, počnite provjeravanjem dnevnika i lokalnih podataka koje pohranjuje na disku.</p>\n<hr>\n<h2 id="dnevnici"><a href="#dnevnici">Dnevnici</a></h2>\n<p>Log fajlovi se pišu na:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> i zalijepite <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Datoteke evidencije se imenuju vremenskim oznakama (npr. <code dir="auto">2025-01-09T123456.log</code>) i čuvaju se najnovijih 10 datoteka dnevnika.</p>\n<p>Možete postaviti nivo dnevnika pomoću opcije komandne linije <code dir="auto">--log-level</code> da biste dobili detaljnije informacije o otklanjanju grešaka. Na primjer, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="pohrana"><a href="#pohrana">Pohrana</a></h2>\n<p>SlopCode pohranjuje podatke o sesiji i druge podatke aplikacije na disku na:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> i zalijepite <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Ovaj direktorij sadrži:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - ​​Podaci o autentifikaciji kao što su API ključevi, OAuth tokeni</li>\n<li><code dir="auto">log/</code> - ​​Dnevnici aplikacije</li>\n<li><code dir="auto">project/</code> - ​​Podaci specifični za projekat kao što su podaci o sesiji i poruci\n<ul>\n<li>Ako je projekat unutar Git repo-a, on je pohranjen u <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Ako nije Git repo, pohranjuje se u <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="desktop-aplikacija"><a href="#desktop-aplikacija">Desktop aplikacija</a></h2>\n<p>SlopCode Desktop pokreće lokalni SlopCode server (<code dir="auto">slopcode-cli</code> sidecar) u pozadini. Većina problema je uzrokovana nedostatkom dodatka, oštećenom keš memorijom ili lošim postavkama servera.</p>\n<h3 id="brze-provjere"><a href="#brze-provjere">Brze provjere</a></h3>\n<ul>\n<li>Potpuno zatvorite i ponovo pokrenite aplikaciju.</li>\n<li>Ako aplikacija prikaže ekran s greškom, kliknite na <strong>Restart</strong> i kopirajte detalje o grešci.</li>\n<li>samo za macOS: <code dir="auto">SlopCode</code> meni -> <strong>Ponovo učitaj Webview</strong> (pomaže ako je korisnički interfejs prazan/zamrznut).</li>\n</ul>\n<hr>\n<h3 id="onemogućavanje-dodataka"><a href="#onemogućavanje-dodataka">Onemogućavanje dodataka</a></h3>\n<p>Ako se desktop aplikacija ruši pri pokretanju, visi ili se čudno ponaša, počnite s onemogućavanjem dodataka.</p>\n<h4 id="provjerite-globalnu-konfiguraciju"><a href="#provjerite-globalnu-konfiguraciju">Provjerite globalnu konfiguraciju</a></h4>\n<p>Otvorite svoju globalnu konfiguracijsku datoteku i potražite ključ <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (ili <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (starije instalacije): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> i zalijepite <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Ako imate konfigurirane dodatke, privremeno ih onemogućite uklanjanjem ključa ili postavljanjem na prazan niz:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="provjera-direktorija-dodataka"><a href="#provjera-direktorija-dodataka">Provjera direktorija dodataka</a></h4>\n<p>SlopCode također može učitati lokalne dodatke s diska. Privremeno ih maknite s puta (ili preimenujte folder) i ponovo pokrenite desktop aplikaciju:</p>\n<ul>\n<li><strong>Globalni dodaci</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> i zalijepite <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Projektni dodaci</strong> (samo ako koristite konfiguraciju po projektu)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Ako aplikacija ponovo počne raditi, ponovo omogućite dodatke jedan po jedan kako biste otkrili koji od njih uzrokuje problem.</p>\n<hr>\n<h3 id="brisanje-keš-memorije"><a href="#brisanje-keš-memorije">Brisanje keš memorije</a></h3>\n<p>Ako onemogućavanje dodataka ne pomogne (ili se instalacija dodatka zaglavila), obrišite keš memoriju kako bi ga SlopCode mogao ponovo izgraditi.</p>\n<ol>\n<li>Potpuno zatvorite SlopCode Desktop.</li>\n<li>Izbrišite keš direktorij:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> zalijepi <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: obrišite <code dir="auto">~/.cache/slopcode</code> (ili pokrenite <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> i zalijepite <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Ponovo pokrenite SlopCode Desktop.</li>\n</ol>\n<hr>\n<h3 id="rješavanje-problema-sa-vezom-na-serveru"><a href="#rješavanje-problema-sa-vezom-na-serveru">Rješavanje problema sa vezom na serveru</a></h3>\n<p>SlopCode Desktop može ili pokrenuti svoj lokalni server (podrazumevano) ili se povezati na URL servera koji ste konfigurisali.</p>\n<p>Ako vidite dijaloški okvir <strong>“Povezivanje nije uspjelo”</strong> (ili aplikacija nikada ne prođe kroz početni ekran), provjerite da li postoji prilagođeni URL servera.</p>\n<h4 id="obrišite-zadani-url-servera-radne-površine"><a href="#obrišite-zadani-url-servera-radne-površine">Obrišite zadani URL servera radne površine</a></h4>\n<p>Na početnom ekranu kliknite na ime servera (sa tačkom statusa) da otvorite birač servera. U odjeljku <strong>Podrazumevani server</strong> kliknite na <strong>Obriši</strong>.</p>\n<h4 id="uklonite-serverport--serverhostname-iz-vaše-konfiguracije"><a href="#uklonite-serverport--serverhostname-iz-vaše-konfiguracije">Uklonite <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> iz vaše konfiguracije</a></h4>\n<p>Ako vaš <code dir="auto">slopcode.json(c)</code> sadrži odjeljak <code dir="auto">server</code>, privremeno ga uklonite i ponovo pokrenite desktop aplikaciju.</p>\n<h4 id="provjerite-varijable-okruženja"><a href="#provjerite-varijable-okruženja">Provjerite varijable okruženja</a></h4>\n<p>Ako ste postavili <code dir="auto">SLOPCODE_PORT</code> u svom okruženju, desktop aplikacija će pokušati da koristi taj port za lokalni server.</p>\n<ul>\n<li>Poništite <code dir="auto">SLOPCODE_PORT</code> (ili odaberite slobodan port) i ponovo pokrenite.</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-problemi"><a href="#linux-wayland--x11-problemi">Linux: Wayland / X11 problemi</a></h3>\n<p>Na Linuxu, neka podešavanja Waylanda mogu uzrokovati prazne prozore ili greške sastavljača.</p>\n<ul>\n<li>Ako ste na Waylandu, a aplikacija je prazna/ispada, pokušajte pokrenuti sa <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Ako to pogorša stvari, uklonite ga i pokušajte pokrenuti pod X11 sesijom umjesto toga.</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-izvršno-okruženje"><a href="#windows-webview2-izvršno-okruženje">Windows: WebView2 izvršno okruženje</a></h3>\n<p>Na Windows-u, SlopCode Desktop zahtijeva Microsoft Edge <strong>WebView2 Runtime</strong>. Ako se aplikacija otvori u praznom prozoru ili se ne pokrene, instalirajte/ažurirajte WebView2 i pokušajte ponovo.</p>\n<hr>\n<h3 id="windows-opšti-problemi-sa-performansama"><a href="#windows-opšti-problemi-sa-performansama">Windows: Opšti problemi sa performansama</a></h3>\n<p>Ako imate spore performanse, probleme s pristupom datotekama ili probleme s terminalom na Windows-u, pokušajte koristiti <a href="/docs/windows-wsl">WSL (Windows podsistem za Linux)</a>. WSL pruža Linux okruženje koje radi neprimetnije sa SlopCode karakteristikama.</p>\n<hr>\n<h3 id="obavještenja-se-ne-prikazuju"><a href="#obavještenja-se-ne-prikazuju">Obavještenja se ne prikazuju</a></h3>\n<p>SlopCode Desktop prikazuje sistemska obavještenja samo kada:</p>\n<ul>\n<li>obavještenja su omogućena za SlopCode u postavkama vašeg OS-a, i</li>\n<li>prozor aplikacije nije fokusiran.</li>\n</ul>\n<hr>\n<h3 id="resetovanje-pohrane-desktop-aplikacije"><a href="#resetovanje-pohrane-desktop-aplikacije">Resetovanje pohrane desktop aplikacije</a></h3>\n<p>Ako se aplikacija ne pokrene i ne možete izbrisati postavke unutar korisničkog sučelja, resetirajte spremljeno stanje desktop aplikacije.</p>\n<ol>\n<li>Zatvorite SlopCode Desktop.</li>\n<li>Pronađite i izbrišite ove datoteke (oni žive u direktoriju podataka SlopCode Desktop aplikacije):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (URL zadanog servera za desktop)</li>\n<li><code dir="auto">slopcode.global.dat</code> i <code dir="auto">slopcode.workspace.*.dat</code> (stanje korisničkog interfejsa poput nedavnih servera/projekata)</li>\n</ul>\n<p>Da brzo pronađete direktorij:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (onda potražite nazive fajlova iznad)</li>\n<li><strong>Linux</strong>: potražite nazive fajlova iznad pod <code dir="auto">~/.local/share</code></li>\n<li><strong>Windows</strong>: Pritisnite <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (zatim potražite nazive fajlova iznad)</li>\n</ul>\n<hr>\n<h2 id="traženje-pomoći"><a href="#traženje-pomoći">Traženje pomoći</a></h2>\n<p>Ako imate problema s SlopCode:</p>\n<ol>\n<li>\n<p><strong>Prijavite probleme na GitHub</strong></p>\n<p>Najbolji način da prijavite greške ili zatražite funkcije je putem našeg GitHub spremišta:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Prije kreiranja novog problema, pretražite postojeće probleme da vidite je li vaš problem već prijavljen.</p>\n</li>\n<li>\n<p><strong>Pridružite se našem Discordu</strong></p>\n<p>Za pomoć u stvarnom vremenu i diskusiju u zajednici, pridružite se našem Discord serveru:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="uobičajeni-problemi"><a href="#uobičajeni-problemi">Uobičajeni problemi</a></h2>\n<p>Evo nekih uobičajenih problema i kako ih riješiti.</p>\n<hr>\n<h3 id="slopcode-se-ne-pokreće"><a href="#slopcode-se-ne-pokreće">SlopCode se ne pokreće</a></h3>\n<ol>\n<li>Provjerite dnevnike za poruke o greškama</li>\n<li>Pokušajte pokrenuti sa <code dir="auto">--print-logs</code> da vidite izlaz u terminalu</li>\n<li>Uvjerite se da imate najnoviju verziju sa <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problemi-s-autentifikacijom"><a href="#problemi-s-autentifikacijom">Problemi s autentifikacijom</a></h3>\n<ol>\n<li>Pokušajte ponovo autentifikovati sa naredbom <code dir="auto">/connect</code> u TUI</li>\n<li>Provjerite da li su vaši API ključevi važeći</li>\n<li>Uvjerite se da vaša mreža dozvoljava veze s API-jem provajdera</li>\n</ol>\n<hr>\n<h3 id="model-nije-dostupan"><a href="#model-nije-dostupan">Model nije dostupan</a></h3>\n<ol>\n<li>Provjerite jeste li se autentifikovali kod provajdera</li>\n<li>Provjerite je li naziv modela u vašoj konfiguraciji tačan</li>\n<li>Neki modeli mogu zahtijevati poseban pristup ili pretplate</li>\n</ol>\n<p>Ako naiđete na <code dir="auto">ProviderModelNotFoundError</code> najvjerovatnije niste u pravu\nreferenciranje modela negdje.\nModele treba referencirati ovako: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>primjeri:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Da saznate kojim modelima imate pristup, pokrenite <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Ako naiđete na grešku ProviderInitError, vjerovatno imate nevažeću ili oštećenu konfiguraciju.</p>\n<p>Da biste ovo riješili:</p>\n<ol>\n<li>Prvo provjerite da li je vaš provajder ispravno postavljen slijedeći <a href="/docs/providers">vodič za pružatelje</a></li>\n<li>Ako se problem nastavi, pokušajte obrisati pohranjenu konfiguraciju:</li>\n</ol>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span class="indent">   </span><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>Na Windows-u pritisnite <code dir="auto">WIN+R</code> i izbrišite: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n<ol start="3">\n<li>Ponovo izvršite autentifikaciju kod svog provajdera koristeći naredbu <code dir="auto">/connect</code> u TUI.</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-i-problemi-sa-paketom-dobavljača"><a href="#ai_apicallerror-i-problemi-sa-paketom-dobavljača">AI_APICallError i problemi sa paketom dobavljača</a></h3>\n<p>Ako naiđete na greške API poziva, to može biti zbog zastarjelih paketa dobavljača. SlopCode dinamički instalira pakete dobavljača (OpenAI, Anthropic, Google, itd.) po potrebi i kešira ih lokalno.</p>\n<p>Da biste riješili probleme s paketom dobavljača:</p>\n<ol>\n<li>Obrišite keš paketa provajdera:</li>\n</ol>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span class="indent">   </span><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>Na Windows-u pritisnite <code dir="auto">WIN+R</code> i izbrišite: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n<ol start="2">\n<li>Ponovo pokrenite SlopCode da ponovo instalirate najnovije pakete dobavljača</li>\n</ol>\n<p>Ovo će prisiliti SlopCode da preuzme najnovije verzije paketa dobavljača, što često rješava probleme kompatibilnosti s parametrima modela i promjenama API-ja.</p>\n<hr>\n<h3 id="copypaste-ne-radi-na-linuxu"><a href="#copypaste-ne-radi-na-linuxu">Copy/paste ne radi na Linuxu</a></h3>\n<p>Korisnici Linuxa moraju imati instaliran jedan od sljedećih uslužnih programa međuspremnika da bi funkcionirala funkcionalnost kopiranja/lijepljenja:</p>\n<p><strong>Za X11 sisteme:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Za Wayland sisteme:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Za okruženja bez glave:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>SlopCode će otkriti da li koristite Wayland i preferirate <code dir="auto">wl-clipboard</code>, u suprotnom će pokušati pronaći alate međuspremnika po redoslijedu: <code dir="auto">xclip</code> i <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/bs/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/bs/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/bs/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
