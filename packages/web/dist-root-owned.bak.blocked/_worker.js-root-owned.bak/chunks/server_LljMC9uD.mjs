globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "Servidor",
  description: "Interactuar con el servidor slopcode a través de HTTP.",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "uso",
      text: "Uso",
    },
    {
      depth: 4,
      slug: "opciones",
      text: "Opciones",
    },
    {
      depth: 3,
      slug: "autenticación",
      text: "Autenticación",
    },
    {
      depth: 3,
      slug: "cómo-funciona",
      text: "Cómo funciona",
    },
    {
      depth: 4,
      slug: "conectarse-a-un-servidor-existente",
      text: "Conectarse a un servidor existente",
    },
    {
      depth: 2,
      slug: "especificaciones",
      text: "Especificaciones",
    },
    {
      depth: 2,
      slug: "api",
      text: "API",
    },
    {
      depth: 3,
      slug: "global",
      text: "Global",
    },
    {
      depth: 3,
      slug: "proyecto",
      text: "Proyecto",
    },
    {
      depth: 3,
      slug: "ruta-y-vcs",
      text: "Ruta y VCS",
    },
    {
      depth: 3,
      slug: "instancia",
      text: "Instancia",
    },
    {
      depth: 3,
      slug: "configuración",
      text: "Configuración",
    },
    {
      depth: 3,
      slug: "proveedor",
      text: "Proveedor",
    },
    {
      depth: 3,
      slug: "sesiones",
      text: "Sesiones",
    },
    {
      depth: 3,
      slug: "mensajes",
      text: "Mensajes",
    },
    {
      depth: 3,
      slug: "comandos",
      text: "Comandos",
    },
    {
      depth: 3,
      slug: "archivos",
      text: "Archivos",
    },
    {
      depth: 4,
      slug: "parámetros-de-consulta-de-findfile",
      text: "Parámetros de consulta de /find/file",
    },
    {
      depth: 3,
      slug: "herramientas-experimentales",
      text: "Herramientas (experimentales)",
    },
    {
      depth: 3,
      slug: "lsp-formateadores-y-mcp",
      text: "LSP, formateadores y MCP",
    },
    {
      depth: 3,
      slug: "agentes",
      text: "Agentes",
    },
    {
      depth: 3,
      slug: "registro",
      text: "Registro",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "autenticación-1",
      text: "Autenticación",
    },
    {
      depth: 3,
      slug: "eventos",
      text: "Eventos",
    },
    {
      depth: 3,
      slug: "documentación",
      text: "Documentación",
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
          '<p>El comando <code dir="auto">slopcode serve</code> ejecuta un servidor HTTP sin cabeza que expone un punto final OpenAPI que un cliente slopcode puede usar.</p>\n<hr>\n<h3 id="uso"><a href="#uso">Uso</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="opciones"><a href="#opciones">Opciones</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Bandera</th><th>Descripción</th><th>Predeterminado</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>Puerto para escuchar</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>Nombre de host para escuchar</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>Habilitar el descubrimiento de mDNS</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>Nombre de dominio personalizado para el servicio mDNS</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>Orígenes de navegador adicionales para permitir</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p><code dir="auto">--cors</code> se puede pasar varias veces:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="autenticación"><a href="#autenticación">Autenticación</a></h3>\n<p>Configure <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> para proteger el servidor con autenticación básica HTTP. El nombre de usuario predeterminado es <code dir="auto">slopcode</code>, o configure <code dir="auto">SLOPCODE_SERVER_USERNAME</code> para anularlo. Esto se aplica tanto a <code dir="auto">slopcode serve</code> como a <code dir="auto">slopcode web</code>.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="cómo-funciona"><a href="#cómo-funciona">Cómo funciona</a></h3>\n<p>Cuando ejecuta <code dir="auto">slopcode</code>, inicia un TUI y un servidor. Donde el TUI es el\nCliente que habla con el servidor. El servidor expone una especificación OpenAPI 3.1\npunto final. Este punto final también se utiliza para generar un <a href="/docs/sdk">SDK</a>.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>Utilice el servidor slopcode para interactuar con slopcode mediante programación.</p></div></aside>\n<p>Esta arquitectura permite que slopcode admita múltiples clientes y le permite interactuar con slopcode mediante programación.</p>\n<p>Puede ejecutar <code dir="auto">slopcode serve</code> para iniciar un servidor independiente. Si tienes el\nslopcode TUI ejecutándose, <code dir="auto">slopcode serve</code> iniciará un nuevo servidor.</p>\n<hr>\n<h4 id="conectarse-a-un-servidor-existente"><a href="#conectarse-a-un-servidor-existente">Conectarse a un servidor existente</a></h4>\n<p>Cuando inicia el TUI, asigna aleatoriamente un puerto y un nombre de host. En su lugar, puede pasar <code dir="auto">--hostname</code> y <code dir="auto">--port</code> <a href="/docs/cli">banderas</a>. Luego use esto para conectarse a su servidor.</p>\n<p>El punto final <a href="#tui"><code dir="auto">/tui</code></a> se puede utilizar para conducir el TUI a través del servidor. Por ejemplo, puede completar previamente o ejecutar un mensaje. Esta configuración es utilizada por los complementos SlopCode <a href="/docs/ide">IDE</a>.</p>\n<hr>\n<h2 id="especificaciones"><a href="#especificaciones">Especificaciones</a></h2>\n<p>El servidor publica una especificación OpenAPI 3.1 que se puede ver en:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>Por ejemplo, <code dir="auto">http://localhost:4096/doc</code>. Utilice la especificación para generar clientes o inspeccionar tipos de solicitudes y respuestas. O verlo en un explorador Swagger.</p>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>El servidor slopcode expone las siguientes API.</p>\n<hr>\n<h3 id="global"><a href="#global">Global</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>Obtener el estado y la versión del servidor</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>Obtenga eventos globales (transmisión SSE)</td><td>Flujo de eventos</td></tr></tbody></table>\n<hr>\n<h3 id="proyecto"><a href="#proyecto">Proyecto</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Listar todos los proyectos",
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
                    children: "Obtener el proyecto actual",
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
          '<hr>\n<h3 id="ruta-y-vcs"><a href="#ruta-y-vcs">Ruta y VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Obtener la ruta actual",
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
                    children: "Obtenga información de VCS para el proyecto actual",
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
          '<hr>\n<h3 id="instancia"><a href="#instancia">Instancia</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>Eliminar la instancia actual</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="configuración"><a href="#configuración">Configuración</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Obtener información de configuración",
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
                    children: "Actualizar configuración",
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
                    children: "Lista de proveedores y modelos predeterminados",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ providers: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Proveedor[]",
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
          '<hr>\n<h3 id="proveedor"><a href="#proveedor">Proveedor</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Listar todos los proveedores",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ all: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Proveedor[]",
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
                    children: "Obtener métodos de autenticación de proveedores",
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
                    children: "Autorizar a un proveedor usando OAuth",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>Manejar la devolución de llamada OAuth para un proveedor</td><td><code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="sesiones"><a href="#sesiones">Sesiones</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Notas",
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
                    children: "Listar todas las sesiones",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                    children: "Crear una nueva sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      ", devuelve ",
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
                    children: "Obtener el estado de la sesión para todas las sesiones",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [sessionID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "SessionStatus",
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
                    children: "Obtener detalles de la sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>Eliminar una sesión y todos sus datos</td><td>Devuelve <code dir="auto">boolean</code></td>',
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
                    children: "Actualizar propiedades de sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      ", devuelve ",
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
                    children: "Obtener las sesiones secundarias de una sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                    children: "Obtener la lista de tareas pendientes para una sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>Analizar aplicación y crear <code dir="auto">AGENTS.md</code></td><td>cuerpo: <code dir="auto">{ messageID, providerID, modelID }</code>, devuelve <code dir="auto">boolean</code></td>',
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
                    children: "Bifurca una sesión existente en un mensaje",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      ", devuelve ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>Cancelar una sesión en ejecución</td><td>Devuelve <code dir="auto">boolean</code></td>',
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
                    children: "Compartir una sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                    children: "Dejar de compartir una sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
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
                    children: "Obtenga la diferencia para esta sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "consulta: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      ", devuelve ",
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
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>Resumir la sesión</td><td>cuerpo: <code dir="auto">{ providerID, modelID }</code>, devuelve <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>Revertir un mensaje</td><td>cuerpo: <code dir="auto">{ messageID, partID? }</code>, devuelve <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>Restaurar todos los mensajes revertidos</td><td>Devuelve <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>Responder a una solicitud de permiso</td><td>cuerpo: <code dir="auto">{ response, remember? }</code>, devuelve <code dir="auto">boolean</code></td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="mensajes"><a href="#mensajes">Mensajes</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Notas",
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
                    children: "Listar mensajes en una sesión",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "consulta: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      ", devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Mensaje",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Parte[]",
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
                    children: "Envía un mensaje y espera respuesta",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      ", devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Mensaje",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Parte[]",
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
                    children: "Obtener detalles del mensaje",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Mensaje",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Parte[]",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>Enviar un mensaje de forma asincrónica (sin espera)</td><td>cuerpo: igual que <code dir="auto">/session/:id/message</code>, devuelve <code dir="auto">204 No Content</code></td>',
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
                    children: "Ejecutar un comando de barra diagonal",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      ", devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Mensaje",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Parte[]",
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
                    children: "Ejecute un comando de shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "cuerpo: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      ", devuelve ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Mensaje",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Parte[]",
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
        "set:html": '<hr>\n<h3 id="comandos"><a href="#comandos">Comandos</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                  children: "Listar todos los comandos",
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
          '<hr>\n<h3 id="archivos"><a href="#archivos">Archivos</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Buscar texto en archivos",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Matriz de objetos coincidentes con ",
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
                    children: "Buscar archivos y directorios por nombre",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (caminos)",
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
                    children: "Buscar símbolos del espacio de trabajo",
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
                    children: "Listar archivos y directorios",
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
                    children: "Leer un archivo",
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
                    children: "Obtener el estado de los archivos rastreados",
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
          '<h4 id="parámetros-de-consulta-de-findfile"><a href="#parámetros-de-consulta-de-findfile">Parámetros de consulta de /find/file</a></h4>\n<ul>\n<li><code dir="auto">query</code> (obligatorio) — cadena de búsqueda (coincidencia aproximada)</li>\n<li><code dir="auto">type</code> (opcional): limita los resultados a <code dir="auto">"file"</code> o <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code> (opcional): anula la raíz del proyecto para la búsqueda.</li>\n<li><code dir="auto">limit</code> (opcional) — resultados máximos (1–200)</li>\n<li><code dir="auto">dirs</code> (opcional): indicador heredado (<code dir="auto">"false"</code> devuelve solo archivos)</li>\n</ul>\n<hr>\n<h3 id="herramientas-experimentales"><a href="#herramientas-experimentales">Herramientas (experimentales)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Listar todos los ID de herramientas",
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
                    children: "Listar herramientas con esquemas JSON para un modelo",
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
          '<hr>\n<h3 id="lsp-formateadores-y-mcp"><a href="#lsp-formateadores-y-mcp">LSP, formateadores y MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                    children: "Obtener el estado del servidor LSP",
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
                    children: "Obtener estado del formateador",
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
                    children: "Obtener el estado del servidor MCP",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>Agregue el servidor MCP dinámicamente</td><td>cuerpo: <code dir="auto">{ name, config }</code>, devuelve MCP objeto de estado</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="agentes"><a href="#agentes">Agentes</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Método",
                }),
                createVNode(_components.th, {
                  children: "Ruta",
                }),
                createVNode(_components.th, {
                  children: "Descripción",
                }),
                createVNode(_components.th, {
                  children: "Respuesta",
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
                  children: "Listar todos los agentes disponibles",
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
          '<hr>\n<h3 id="registro"><a href="#registro">Registro</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>Escribir entrada de registro. Cuerpo: <code dir="auto">{ service, level, message, extra? }</code></td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>Agregar texto al mensaje</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>Abra el cuadro de diálogo de ayuda</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>Abrir el selector de sesiones</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>Abra el selector de temas</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>Abrir el selector de modelo</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>Enviar el mensaje actual</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>Borrar el mensaje</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>Ejecutar un comando (<code dir="auto">{ command }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>Mostrar brindis (<code dir="auto">{ title?, message, variant }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>Espere la próxima solicitud de control</td><td>Objeto de solicitud de control</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>Responder a una solicitud de control (<code dir="auto">{ body }</code>)</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="autenticación-1"><a href="#autenticación-1">Autenticación</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>Establecer credenciales de autenticación. El cuerpo debe coincidir con el esquema del proveedor</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="eventos"><a href="#eventos">Eventos</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>Transmisión de eventos enviados por el servidor. El primer evento es <code dir="auto">server.connected</code>, luego eventos de bus</td><td>Transmisión de eventos enviados por el servidor</td></tr></tbody></table>\n<hr>\n<h3 id="documentación"><a href="#documentación">Documentación</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Respuesta</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>Especificación OpenAPI 3.1</td><td>Página HTML con especificación OpenAPI</td></tr></tbody></table>',
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

const url = "src/content/docs/es/server.mdx"
const file = "/app/packages/web/src/content/docs/es/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/es/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
