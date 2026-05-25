globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Rozwiązywanie problemów",
  description: "Typowe problemy i sposoby ich rozwiązywania.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "dzienniki",
      text: "Dzienniki",
    },
    {
      depth: 2,
      slug: "przechowywanie-danych",
      text: "Przechowywanie danych",
    },
    {
      depth: 2,
      slug: "aplikacja-desktopowa",
      text: "Aplikacja desktopowa",
    },
    {
      depth: 3,
      slug: "szybkie-sprawdzenie",
      text: "Szybkie sprawdzenie",
    },
    {
      depth: 3,
      slug: "wyłączanie-wtyczek",
      text: "Wyłączanie wtyczek",
    },
    {
      depth: 4,
      slug: "sprawdź-konfigurację-globalną",
      text: "Sprawdź konfigurację globalną",
    },
    {
      depth: 4,
      slug: "sprawdź-katalogi-wtyczek",
      text: "Sprawdź katalogi wtyczek",
    },
    {
      depth: 3,
      slug: "wyczyść-pamięć-podręczną",
      text: "Wyczyść pamięć podręczną",
    },
    {
      depth: 3,
      slug: "napraw-problemy-z-połączeniem-z-serwerem",
      text: "Napraw problemy z połączeniem z serwerem",
    },
    {
      depth: 4,
      slug: "wyczyść-domyślny-adres-url-serwera-na-komputerze",
      text: "Wyczyść domyślny adres URL serwera na komputerze",
    },
    {
      depth: 4,
      slug: "usuń-serverport--serverhostname-ze-swojej-konfiguracji",
      text: "Usuń server.port / server.hostname ze swojej konfiguracji",
    },
    {
      depth: 4,
      slug: "sprawdź-zmienne-środowiskowe",
      text: "Sprawdź zmienne środowiskowe",
    },
    {
      depth: 3,
      slug: "linux-problemy-z-wayland--x11",
      text: "Linux: Problemy z Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-środowisko-uruchomieniowe-webview2",
      text: "Windows: Środowisko uruchomieniowe WebView2",
    },
    {
      depth: 3,
      slug: "windows-ogólne-problemy-z-wydajnością",
      text: "Windows: Ogólne problemy z wydajnością",
    },
    {
      depth: 3,
      slug: "brak-powiadomień",
      text: "Brak powiadomień",
    },
    {
      depth: 3,
      slug: "resetowanie-pamięci-aplikacji",
      text: "Resetowanie pamięci aplikacji",
    },
    {
      depth: 2,
      slug: "uzyskiwanie-pomocy",
      text: "Uzyskiwanie pomocy",
    },
    {
      depth: 2,
      slug: "typowe-problemy",
      text: "Typowe problemy",
    },
    {
      depth: 3,
      slug: "slopcode-nie-uruchamia-się",
      text: "slopcode nie uruchamia się",
    },
    {
      depth: 3,
      slug: "problemy-z-uwierzytelnianiem",
      text: "Problemy z uwierzytelnianiem",
    },
    {
      depth: 3,
      slug: "model-niedostępny",
      text: "Model niedostępny",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "błędy-ai_apicallerror-i-problemy-z-pakietami-dostawców",
      text: "Błędy AI_APICallError i problemy z pakietami dostawców",
    },
    {
      depth: 3,
      slug: "kopiowaniewklejanie-nie-działa-na-linuxie",
      text: "Kopiowanie/wklejanie nie działa na Linuxie",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Aby debugować problemy z slopcode, zacznij od sprawdzenia dzienników i danych lokalnych przechowywanych na dysku.</p>\n<hr>\n<h2 id="dzienniki"><a href="#dzienniki">Dzienniki</a></h2>\n<p>Pliki logów są zapisywane w:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> i wklej <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Nazwy plików dziennika zawierają znaczniki czasu (np. <code dir="auto">2025-01-09T123456.log</code>) i przechowywanych jest 10 ostatnich plików dziennika.</p>\n<p>Możesz ustawić poziom dziennika za pomocą opcji wiersza poleceń <code dir="auto">--log-level</code>, aby uzyskać bardziej szczegółowe informacje debugowania. Na przykład <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="przechowywanie-danych"><a href="#przechowywanie-danych">Przechowywanie danych</a></h2>\n<p>slopcode przechowuje dane sesji i inne dane aplikacji na dysku pod adresem:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> i wklej <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Ten katalog zawiera:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Authentication data like API keys, OAuth tokens</li>\n<li><code dir="auto">log/</code> - Application logs</li>\n<li><code dir="auto">project/</code> — Dane specyficzne dla projektu, takie jak dane sesji i komunikatów\n<ul>\n<li>Jeśli projekt znajduje się w repozytorium Git, jest on przechowywany w <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>If it is not a Git repo, it is stored in <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="aplikacja-desktopowa"><a href="#aplikacja-desktopowa">Aplikacja desktopowa</a></h2>\n<p>slopcode Desktop uruchamia w tle lokalny serwer slopcode (sidecar <code dir="auto">slopcode-cli</code>). Większość problemów jest spowodowana nieprawidłowo działającą wtyczką, uszkodzoną pamięcią podręczną lub złymi ustawieniami serwera.</p>\n<h3 id="szybkie-sprawdzenie"><a href="#szybkie-sprawdzenie">Szybkie sprawdzenie</a></h3>\n<ul>\n<li>Całkowicie zakończ i uruchom ponownie aplikację.</li>\n<li>Jeśli aplikacja wyświetli ekran błędu, kliknij <strong>Uruchom ponownie</strong> i skopiuj szczegóły błędu.</li>\n<li>Tylko macOS: menu <code dir="auto">SlopCode</code> -> <strong>Załaduj ponownie przeglądarkę internetową</strong> (pomaga, jeśli interfejs użytkownika jest pusty/zawieszony).</li>\n</ul>\n<hr>\n<h3 id="wyłączanie-wtyczek"><a href="#wyłączanie-wtyczek">Wyłączanie wtyczek</a></h3>\n<p>Jeśli aplikacja komputerowa ulega awarii podczas uruchamiania, zawiesza się lub zachowuje się dziwnie, zacznij od wyłączenia wtyczek.</p>\n<h4 id="sprawdź-konfigurację-globalną"><a href="#sprawdź-konfigurację-globalną">Sprawdź konfigurację globalną</a></h4>\n<p>Otwórz globalny plik konfiguracyjny i poszukaj klucza <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (lub <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (starsze instalacje): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> i wklej <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Jeśli masz skonfigurowane wtyczki, tymczasowo je wyłącz, usuwając klucz lub ustawiając go na pustą tablicę:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="sprawdź-katalogi-wtyczek"><a href="#sprawdź-katalogi-wtyczek">Sprawdź katalogi wtyczek</a></h4>\n<p>slopcode może także ładować lokalne wtyczki z dysku. Tymczasowo usuń je (lub zmień nazwę folderu) i uruchom ponownie aplikację komputerową:</p>\n<ul>\n<li><strong>Wtyczki globalne</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> i wklej <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Wtyczki projektowe</strong> (tylko jeśli używasz konfiguracji dla poszczególnych projektów)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Jeśli aplikacja ponownie zacznie działać, włączaj ponownie wtyczki pojedynczo, aby dowiedzieć się, która powoduje problem.</p>\n<hr>\n<h3 id="wyczyść-pamięć-podręczną"><a href="#wyczyść-pamięć-podręczną">Wyczyść pamięć podręczną</a></h3>\n<p>Jeśli wyłączenie wtyczek nie pomoże (lub instalacja wtyczki utknęła), wyczyść pamięć podręczną, aby slopcode mógł ją odbudować.</p>\n<ol>\n<li>Całkowicie zamknij slopcode Desktop.</li>\n<li>Usuń katalog pamięci podręcznej:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> paste <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: usuń <code dir="auto">~/.cache/slopcode</code> (lub uruchom <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> i wklej <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Uruchom ponownie slopcode Desktop.</li>\n</ol>\n<hr>\n<h3 id="napraw-problemy-z-połączeniem-z-serwerem"><a href="#napraw-problemy-z-połączeniem-z-serwerem">Napraw problemy z połączeniem z serwerem</a></h3>\n<p>slopcode Desktop może uruchomić własny serwer lokalny (domyślnie) lub połączyć się ze skonfigurowanym adresem URL serwera.</p>\n<p>Jeśli zobaczysz okno dialogowe <strong>„Połączenie nie powiodło się”</strong> (lub aplikacja nigdy nie wychodzi poza ekran powitalny), sprawdź, czy jest niestandardowy adres URL serwera.</p>\n<h4 id="wyczyść-domyślny-adres-url-serwera-na-komputerze"><a href="#wyczyść-domyślny-adres-url-serwera-na-komputerze">Wyczyść domyślny adres URL serwera na komputerze</a></h4>\n<p>Na ekranie głównym kliknij nazwę serwera (z kropką stanu), aby otworzyć selektor serwerów. W sekcji <strong>Serwer domyślny</strong> kliknij <strong>Wyczyść</strong>.</p>\n<h4 id="usuń-serverport--serverhostname-ze-swojej-konfiguracji"><a href="#usuń-serverport--serverhostname-ze-swojej-konfiguracji">Usuń <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> ze swojej konfiguracji</a></h4>\n<p>Jeśli Twój <code dir="auto">slopcode.json(c)</code> zawiera sekcję <code dir="auto">server</code>, tymczasowo usuń ją i uruchom ponownie aplikację komputerową.</p>\n<h4 id="sprawdź-zmienne-środowiskowe"><a href="#sprawdź-zmienne-środowiskowe">Sprawdź zmienne środowiskowe</a></h4>\n<p>Jeśli w swoim środowisku masz ustawiony <code dir="auto">SLOPCODE_PORT</code>, aplikacja komputerowa spróbuje użyć tego portu dla serwera lokalnego.</p>\n<ul>\n<li>usuń <code dir="auto">SLOPCODE_PORT</code> (lub wybierz wolny port) i uruchom ponownie.</li>\n</ul>\n<hr>\n<h3 id="linux-problemy-z-wayland--x11"><a href="#linux-problemy-z-wayland--x11">Linux: Problemy z Wayland / X11</a></h3>\n<p>W systemie Linux, niektóre konfiguracje Wayland mogą powodować puste okna lub błędy kompozytora.</p>\n<ul>\n<li>Jeśli korzystasz z Wayland, a aplikacja jest pusta/ ulega awarii, spróbuj uruchomić ją za pomocą <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Jeśli to pogorszy sprawę, usuń go i zamiast tego spróbuj uruchomić w sesji X11.</li>\n</ul>\n<hr>\n<h3 id="windows-środowisko-uruchomieniowe-webview2"><a href="#windows-środowisko-uruchomieniowe-webview2">Windows: Środowisko uruchomieniowe WebView2</a></h3>\n<p>W systemie Windows slopcode Desktop wymaga Microsoft Edge <strong>WebView2 Runtime</strong>. Jeśli aplikacja otwiera się w pustym oknie lub nie uruchamia się, zainstaluj/zaktualizuj WebView2 i spróbuj ponownie.</p>\n<hr>\n<h3 id="windows-ogólne-problemy-z-wydajnością"><a href="#windows-ogólne-problemy-z-wydajnością">Windows: Ogólne problemy z wydajnością</a></h3>\n<p>Jeśli doświadczasz niskiej wydajności, problemów z dostępem do plików lub problemów z terminalem w systemie Windows, spróbuj użyć [WSL (podsystem Windows dla systemu Linux) (./windows-wsl). WSL zapewnia środowisko Linux, które płynniej współpracuje z funkcjami slopcode.</p>\n<hr>\n<h3 id="brak-powiadomień"><a href="#brak-powiadomień">Brak powiadomień</a></h3>\n<p>slopcode Desktop pokazuje powiadomienia systemowe tylko wtedy, gdy:</p>\n<ul>\n<li>powiadomienia są włączone dla slopcode w ustawieniach systemu operacyjnego, oraz</li>\n<li>okno aplikacji nie jest aktywne.</li>\n</ul>\n<hr>\n<h3 id="resetowanie-pamięci-aplikacji"><a href="#resetowanie-pamięci-aplikacji">Resetowanie pamięci aplikacji</a></h3>\n<p>Jeśli aplikacja nie uruchamia się i nie możesz wyczyścić ustawień w interfejsie użytkownika, zresetuj zapisany stan aplikacji komputerowej.</p>\n<ol>\n<li>Zamknij całkowicie slopcode Desktop.</li>\n<li>Znajdź i usuń te pliki (znajdują się w katalogu danych aplikacji slopcode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (domyślny adres URL serwera na komputerze stacjonarnym)</li>\n<li><code dir="auto">slopcode.global.dat</code> i <code dir="auto">slopcode.workspace.*.dat</code> (stan interfejsu użytkownika, taki jak najnowsze serwery/projekty)</li>\n</ul>\n<p>Aby szybko znaleźć katalog:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (następnie wyszukaj nazwy plików powyżej)</li>\n<li><strong>Linux</strong>: wyszukaj powyższe nazwy plików pod <code dir="auto">~/.local/share</code></li>\n<li><strong>Windows</strong>: Naciśnij <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (następnie wyszukaj nazwy plików powyżej)</li>\n</ul>\n<hr>\n<h2 id="uzyskiwanie-pomocy"><a href="#uzyskiwanie-pomocy">Uzyskiwanie pomocy</a></h2>\n<p>Jeśli masz problemy z slopcode:</p>\n<ol>\n<li>\n<p><strong>Zgłoś problem na GitHub</strong></p>\n<p>Najlepszym sposobem zgłaszania błędów lub zgłaszania żądań funkcji jest skorzystanie z naszego repozytorium GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Przed utworzeniem nowego problemu przeszukaj istniejące i sprawdź, czy Twój problem nie został już zgłoszony.</p>\n</li>\n<li>\n<p><strong>Dołącz do naszego Discorda</strong></p>\n<p>Aby uzyskać pomoc w czasie rzeczywistym i dyskusję społeczności, dołącz do naszego serwera Discord:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="typowe-problemy"><a href="#typowe-problemy">Typowe problemy</a></h2>\n<p>Oto kilka typowych problemów i sposobów ich rozwiązania.</p>\n<hr>\n<h3 id="slopcode-nie-uruchamia-się"><a href="#slopcode-nie-uruchamia-się">slopcode nie uruchamia się</a></h3>\n<ol>\n<li>Sprawdź dzienniki pod kątem komunikatów o błędach</li>\n<li>Spróbuj uruchomić z <code dir="auto">--print-logs</code>, aby zobaczyć dane wyjściowe w terminalu</li>\n<li>Upewnij się, że masz najnowszą wersję z <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problemy-z-uwierzytelnianiem"><a href="#problemy-z-uwierzytelnianiem">Problemy z uwierzytelnianiem</a></h3>\n<ol>\n<li>Spróbuj ponownie uwierzytelnić się za pomocą polecenia <code dir="auto">/connect</code> w TUI</li>\n<li>Sprawdź, czy klucze API są ważne</li>\n<li>Upewnij się, że Twoja sieć umożliwia połączenia z interfejsem API dostawcy</li>\n</ol>\n<hr>\n<h3 id="model-niedostępny"><a href="#model-niedostępny">Model niedostępny</a></h3>\n<ol>\n<li>Sprawdź, czy dokonałeś uwierzytelnienia u dostawcy</li>\n<li>Sprawdź, czy nazwa modelu w konfiguracji jest poprawna</li>\n<li>Niektóre modele mogą wymagać określonego dostępu lub subskrypcji</li>\n</ol>\n<p>Jeśli napotkasz <code dir="auto">ProviderModelNotFoundError</code>, najprawdopodobniej\nbłędnie odwołujesz się gdzieś do modelu.\nModele powinny być wskazywane w ten sposób: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Przykłady:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Aby dowiedzieć się, do jakich modeli masz dostęp, uruchom <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Jeśli napotkasz błąd ProviderInitError, prawdopodobnie masz nieprawidłową lub uszkodzoną konfigurację.</p>\n<p>Aby rozwiązać ten problem:</p>\n<ol>\n<li>\n<p>Najpierw sprawdź, czy Twój dostawca jest prawidłowo skonfigurowany, postępując zgodnie z <a href="/docs/providers">przewodnikiem dostawców</a></p>\n</li>\n<li>\n<p>Jeśli problem będzie się powtarzał, spróbuj wyczyścić zapisaną konfigurację:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>W systemie Windows naciśnij <code dir="auto">WIN+R</code> i usuń: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Ponownie uwierzytelnij się u swojego dostawcy za pomocą polecenia <code dir="auto">/connect</code> w TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="błędy-ai_apicallerror-i-problemy-z-pakietami-dostawców"><a href="#błędy-ai_apicallerror-i-problemy-z-pakietami-dostawców">Błędy AI_APICallError i problemy z pakietami dostawców</a></h3>\n<p>Jeśli napotkasz błędy wywołań API, może to wynikać z nieaktualnych pakietów dostawców. slopcode dynamicznie instaluje pakiety dostawców (OpenAI, Anthropic, Google itp.) w razie potrzeby i przechowuje je lokalnie w pamięci podręcznej.</p>\n<p>Aby rozwiązać problemy z pakietem dostawcy:</p>\n<ol>\n<li>\n<p>Wyczyść pamięć podręczną pakietu dostawcy:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>W systemie Windows naciśnij <code dir="auto">WIN+R</code> i usuń: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Uruchom ponownie kod slopcode, aby ponownie zainstalować najnowsze pakiety dostawców</p>\n</li>\n</ol>\n<p>Zmusi to slopcode do pobrania najnowszych wersji pakietów dostawców, co często rozwiązuje problemy ze zgodnością z parametrami modelu i zmianami API.</p>\n<hr>\n<h3 id="kopiowaniewklejanie-nie-działa-na-linuxie"><a href="#kopiowaniewklejanie-nie-działa-na-linuxie">Kopiowanie/wklejanie nie działa na Linuxie</a></h3>\n<p>Aby funkcja kopiowania/wklejania działała, użytkownicy systemu Linux muszą mieć zainstalowane jedno z następujących narzędzi schowka:</p>\n<p><strong>Dla systemów X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Dla systemów Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Dla środowisk headless:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode wykryje, czy używasz Waylanda i wolisz <code dir="auto">wl-clipboard</code>, w przeciwnym razie spróbuje znaleźć narzędzia schowka w kolejności: <code dir="auto">xclip</code> i <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/pl/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pl/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
