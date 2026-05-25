globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "Serwer",
  description: "Interakcja z serwerem slopcode za pośrednictwem protokołu HTTP.",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "użycie",
      text: "Użycie",
    },
    {
      depth: 4,
      slug: "opcje",
      text: "Opcje",
    },
    {
      depth: 3,
      slug: "uwierzytelnianie",
      text: "Uwierzytelnianie",
    },
    {
      depth: 3,
      slug: "jak-to-działa",
      text: "Jak to działa",
    },
    {
      depth: 4,
      slug: "połączenie-z-istniejącym-serwerem",
      text: "Połączenie z istniejącym serwerem",
    },
    {
      depth: 2,
      slug: "specyfikacja",
      text: "Specyfikacja",
    },
    {
      depth: 2,
      slug: "api",
      text: "API",
    },
    {
      depth: 3,
      slug: "globalne",
      text: "Globalne",
    },
    {
      depth: 3,
      slug: "projekt",
      text: "Projekt",
    },
    {
      depth: 3,
      slug: "ścieżka-i-vcs",
      text: "Ścieżka i VCS",
    },
    {
      depth: 3,
      slug: "instancja",
      text: "Instancja",
    },
    {
      depth: 3,
      slug: "konfiguracja",
      text: "Konfiguracja",
    },
    {
      depth: 3,
      slug: "dostawca",
      text: "Dostawca",
    },
    {
      depth: 3,
      slug: "sesje",
      text: "Sesje",
    },
    {
      depth: 3,
      slug: "wiadomości",
      text: "Wiadomości",
    },
    {
      depth: 3,
      slug: "polecenia",
      text: "Polecenia",
    },
    {
      depth: 3,
      slug: "pliki",
      text: "Pliki",
    },
    {
      depth: 4,
      slug: "findfile-query-parameters",
      text: "/find/file query parameters",
    },
    {
      depth: 3,
      slug: "narzędzia-eksperymentalne",
      text: "Narzędzia (Eksperymentalne)",
    },
    {
      depth: 3,
      slug: "lsp-formatery-i-mcp",
      text: "LSP, Formatery i MCP",
    },
    {
      depth: 3,
      slug: "agenci",
      text: "Agenci",
    },
    {
      depth: 3,
      slug: "logowanie",
      text: "Logowanie",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "uwierzytelnianie-1",
      text: "Uwierzytelnianie",
    },
    {
      depth: 3,
      slug: "zdarzenia",
      text: "Zdarzenia",
    },
    {
      depth: 3,
      slug: "dokumentacja",
      text: "Dokumentacja",
    },
  ]
}
const typesUrl = `${config.github}/blob/dev/packages/sdk/js/src/gen/types.gen.ts`
function _createMdxContent(props) {
  const _components = {
      code: "code",
      table: "table",
      tbody: "tbody",
      td: "td",
      th: "th",
      thead: "thead",
      tr: "tr",
      ...props.components,
    },
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>Komenda <code dir="auto">slopcode serve</code> uruchamia bezgłowy serwer HTTP, który udostępnia punkt końcowy OpenAPI, z którego może korzystać klient slopcode.</p>\n<hr>\n<h3 id="użycie"><a href="#użycie">Użycie</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="opcje"><a href="#opcje">Opcje</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Flaga</th><th>Opis</th><th>Domyślne</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>Port nasłuchiwania</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>Nazwa hosta do nasłuchiwania</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>Włącz wykrywanie mDNS</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>Niestandardowa nazwa domeny dla usługi mDNS</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>Dodatkowe originy przeglądarki do dozwolenia</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p><code dir="auto">--cors</code> można przekazać wiele razy:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="uwierzytelnianie"><a href="#uwierzytelnianie">Uwierzytelnianie</a></h3>\n<p>Ustaw <code dir="auto">SLOPCODE_SERVER_PASSWORD</code>, aby chronić serwer za pomocą podstawowego uwierzytelniania HTTP. Domyślną nazwą użytkownika jest <code dir="auto">slopcode</code> lub ustaw <code dir="auto">SLOPCODE_SERVER_USERNAME</code>, aby ją zastąpić. Dotyczy to zarówno <code dir="auto">slopcode serve</code>, jak i <code dir="auto">slopcode web</code>.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="jak-to-działa"><a href="#jak-to-działa">Jak to działa</a></h3>\n<p>Kiedy uruchomisz <code dir="auto">slopcode</code>, uruchomi się TUI i serwer. Gdzie jest TUI\nklient komunikujący się z serwerem. Serwer udostępnia specyfikację OpenAPI 3.1\npunkt końcowy. Ten punkt końcowy jest również używany do generowania <a href="/docs/sdk">SDK</a>.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>Użyj serwera slopcode do programowej interakcji z slopcode.</p></div></aside>\n<p>Ta architektura umożliwia obsługę wielu klientów przez slopcode i programową interakcję z kodem otwartym.</p>\n<p>Możesz uruchomić <code dir="auto">slopcode serve</code>, aby uruchomić samodzielny serwer. Jeśli masz\nslopcode TUI działa, <code dir="auto">slopcode serve</code> uruchomi nowy serwer.</p>\n<hr>\n<h4 id="połączenie-z-istniejącym-serwerem"><a href="#połączenie-z-istniejącym-serwerem">Połączenie z istniejącym serwerem</a></h4>\n<p>Po uruchomieniu TUI losowo przypisuje port i nazwę hosta. Zamiast tego możesz przekazać <code dir="auto">--hostname</code> i <code dir="auto">--port</code> <a href="/docs/cli">flagi</a>. Następnie użyj tego, aby połączyć się z serwerem.</p>\n<p>Punktu końcowego <a href="#TUI"><code dir="auto">/tui</code></a> można użyć do sterowania TUI przez serwer. Można na przykład wstępnie wypełnić lub uruchomić monit. Ta konfiguracja jest używana przez wtyczki slopcode <a href="/docs/ide">IDE</a>.</p>\n<hr>\n<h2 id="specyfikacja"><a href="#specyfikacja">Specyfikacja</a></h2>\n<p>Serwer publikuje specyfikację OpenAPI 3.1, którą można obejrzeć pod adresem:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>Na przykład <code dir="auto">http://localhost:4096/doc</code>. Użyj specyfikacji, aby wygenerować klientów lub sprawdzić typy żądań i odpowiedzi. Możesz też wyświetlić go w eksploratorze Swagger.</p>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>Serwer slopcode udostępnia następujące interfejsy API.</p>\n<hr>\n<h3 id="globalne"><a href="#globalne">Globalne</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>Uzyskaj stan i wersję serwera</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>Get global events (SSE stream)</td><td>Event stream</td></tr></tbody></table>\n<hr>\n<h3 id="projekt"><a href="#projekt">Projekt</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/project",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista wszystkich projektów",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Project[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/project/current",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Pobierz bieżący projekt",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Project</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="ścieżka-i-vcs"><a href="#ścieżka-i-vcs">Ścieżka i VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/path",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Pobierz bieżącą ścieżkę",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Path</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/vcs",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj informacje VCS dla bieżącego projektu",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>VcsInfo</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="instancja"><a href="#instancja">Instancja</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>Usuń bieżącą instancję</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="konfiguracja"><a href="#konfiguracja">Konfiguracja</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Get config info",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Config</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "PATCH",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Update config",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Config</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config/providers",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista dostawców i modeli domyślnych",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ providers: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Dostawca[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", default: { [key: string]: string } }",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="dostawca"><a href="#dostawca">Dostawca</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista wszystkich dostawców",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ all: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Dostawca[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", default: {...}, connected: string[] }",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider/auth",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj metody uwierzytelniania dostawcy",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [providerID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ProviderAuthMethod[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider/{id}/oauth/authorize",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Autoryzuj dostawcę za pomocą protokołu OAuth",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ProviderAuthAuthorization</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>Obsługa wywołania zwrotnego OAuth dla dostawcy</td><td><code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="sesje"><a href="#sesje">Sesje</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Notes",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista wszystkich sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Utwórz nową sesję",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      ", zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/status",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj status sesji dla wszystkich sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [sessionID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Status sesji",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj szczegóły sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>Usuń sesję i wszystkie jej dane</td><td>Zwraca <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "PATCH",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Aktualizuj właściwości sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      ", zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/children",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Pobierz sesje podrzędne sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/todo",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Pobierz listę rzeczy do zrobienia dla sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Todo[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>Przeanalizuj aplikację i utwórz <code dir="auto">AGENTS.md</code></td><td>treść: <code dir="auto">{ messageID, providerID, modelID }</code>, zwraca <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/fork",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Rozwiń istniejącą sesję w wiadomości",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      ", zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>Przerwij trwającą sesję</td><td>Zwraca <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/share",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Udostępnij sesję",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "DELETE",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/share",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Anuluj udostępnianie sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/diff",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Pobierz różnicę dla tej sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "zapytanie: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      ", zwraca ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>FileDiff[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>Podsumuj sesję</td><td>treść: <code dir="auto">{ providerID, modelID }</code>, zwraca <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>Przywróć wiadomość</td><td>treść: <code dir="auto">{ messageID, partID? }</code>, zwraca <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>Przywróć wszystkie przywrócone wiadomości</td><td>Zwraca <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>Odpowiedz na prośbę o pozwolenie</td><td>treść: <code dir="auto">{ response, remember? }</code>, zwraca <code dir="auto">boolean</code></td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="wiadomości"><a href="#wiadomości">Wiadomości</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Notes",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista wiadomości w sesji",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "zapytanie: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      ", zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Wiadomość",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Część[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}[]",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Wyślij wiadomość i poczekaj na odpowiedź",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      ", zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Wiadomość",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Część[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message/:messageID",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj szczegóły wiadomości",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Wiadomość",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Część[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>Wyślij wiadomość asynchronicznie (bez czekania)</td><td>treść: taka sama jak <code dir="auto">/session/:id/message</code>, zwraca <code dir="auto">204 No Content</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/command",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Wykonaj slash command",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      ", zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Wiadomość",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Część[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/shell",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uruchom polecenie shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "treść: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      ", zwraca ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Wiadomość",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Część[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="polecenia"><a href="#polecenia">Polecenia</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Metoda",
                }),
                createVNode(_components.th, {
                  children: "Ścieżka",
                }),
                createVNode(_components.th, {
                  children: "Opis",
                }),
                createVNode(_components.th, {
                  children: "Odpowiedź",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "GET",
                  }),
                }),
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "/command",
                  }),
                }),
                createVNode(_components.td, {
                  children: "Lista wszystkich poleceń",
                }),
                createVNode(_components.td, {
                  children: createVNode("a", {
                    href: typesUrl,
                    "set:html": "<code>Command[]</code>",
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="pliki"><a href="#pliki">Pliki</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find?pattern=<pat>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Szukaj tekstu w plikach",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Tablica obiektów dopasowania z ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "path",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "lines",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "line_number",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "absolute_offset",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "submatches",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find/file?query=<q>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Znajdź pliki i katalogi według nazwy",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (ścieżki)",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find/symbol?query=<q>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Find workspace symbols",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Symbol[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file?path=<path>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista plików i katalogów",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FileNode[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file/content?path=<p>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Read a file",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FileContent</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file/status",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj status śledzonych plików",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>File[]</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<h4 id="findfile-query-parameters"><a href="#findfile-query-parameters"><code dir="auto">/find/file</code> query parameters</a></h4>\n<ul>\n<li><code dir="auto">query</code> (required) — search string (fuzzy match)</li>\n<li><code dir="auto">type</code> (optional) — limit results to <code dir="auto">"file"</code> or <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code> (opcjonalnie) — zastąp katalog główny projektu dla wyszukiwania</li>\n<li><code dir="auto">limit</code> (optional) — max results (1–200)</li>\n<li><code dir="auto">dirs</code> (optional) — legacy flag (<code dir="auto">"false"</code> returns only files)</li>\n</ul>\n<hr>\n<h3 id="narzędzia-eksperymentalne"><a href="#narzędzia-eksperymentalne">Narzędzia (Eksperymentalne)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/experimental/tool/ids",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista wszystkich identyfikatorów narzędzi",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ToolIDs</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/experimental/tool?provider=<p>&model=<m>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Lista narzędzi ze schematami JSON dla modelu",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ToolList</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="lsp-formatery-i-mcp"><a href="#lsp-formatery-i-mcp">LSP, Formatery i MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/lsp",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj status serwera LSP",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>LSPStatus[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/formatter",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Get formatter status",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FormatterStatus[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/mcp",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Uzyskaj status serwera MCP",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [name: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "MCPStatus",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>Dodaj dynamicznie serwer MCP</td><td>treść: <code dir="auto">{ name, config }</code>, zwraca obiekt stanu MCP</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="agenci"><a href="#agenci">Agenci</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "Path",
                }),
                createVNode(_components.th, {
                  children: "Description",
                }),
                createVNode(_components.th, {
                  children: "Response",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "GET",
                  }),
                }),
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "/agent",
                  }),
                }),
                createVNode(_components.td, {
                  children: "Lista wszystkich dostępnych agentów",
                }),
                createVNode(_components.td, {
                  children: createVNode("a", {
                    href: typesUrl,
                    "set:html": "<code>Agent[]</code>",
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="logowanie"><a href="#logowanie">Logowanie</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>Write log entry. Body: <code dir="auto">{ service, level, message, extra? }</code></td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>Dołącz tekst do promptu</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>Otwórz okno pomocy</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>Otwórz selektor sesji</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>Otwórz selektor motywów</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>Otwórz selektor modelu</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>Prześlij bieżący prompt</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>Wyczyść prompt</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>Wykonaj polecenie (<code dir="auto">{ command }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>Pokaż toast (<code dir="auto">{ title?, message, variant }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>Poczekaj na następne żądanie kontroli</td><td>Obiekt żądania kontroli</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>Respond to a control request (<code dir="auto">{ body }</code>)</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="uwierzytelnianie-1"><a href="#uwierzytelnianie-1">Uwierzytelnianie</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>Ustaw dane uwierzytelniające. Treść musi pasować do schematu dostawcy</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="zdarzenia"><a href="#zdarzenia">Zdarzenia</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>Strumień zdarzeń wysyłanych przez serwer. Pierwsze wydarzenie to <code dir="auto">server.connected</code>, następnie wydarzenia autobusowe</td><td>Strumień zdarzeń wysłanych przez serwer</td></tr></tbody></table>\n<hr>\n<h3 id="dokumentacja"><a href="#dokumentacja">Dokumentacja</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Response</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>Specyfikacja OpenAPI 3.1</td><td>Strona HTML ze specyfikacją OpenAPI</td></tr></tbody></table>',
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

const url = "src/content/docs/pl/server.mdx"
const file = "/app/packages/web/src/content/docs/pl/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/pl/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
