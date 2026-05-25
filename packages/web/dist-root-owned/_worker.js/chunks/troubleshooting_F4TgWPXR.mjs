globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Solução de Problemas",
  description: "Problemas comuns e como resolvê-los.",
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
      slug: "armazenamento",
      text: "Armazenamento",
    },
    {
      depth: 2,
      slug: "aplicativo-de-desktop",
      text: "Aplicativo de Desktop",
    },
    {
      depth: 3,
      slug: "verificações-rápidas",
      text: "Verificações rápidas",
    },
    {
      depth: 3,
      slug: "desativando-plugins",
      text: "Desativando plugins",
    },
    {
      depth: 4,
      slug: "verificando-a-configuração-global",
      text: "Verificando a configuração global",
    },
    {
      depth: 4,
      slug: "verificando-os-diretórios-de-plugins",
      text: "Verificando os diretórios de plugins",
    },
    {
      depth: 3,
      slug: "limpando-o-cache",
      text: "Limpando o cache",
    },
    {
      depth: 3,
      slug: "corrigindo-problemas-de-conexão-com-o-servidor",
      text: "Corrigindo problemas de conexão com o servidor",
    },
    {
      depth: 4,
      slug: "limpando-a-url-do-servidor-padrão-do-desktop",
      text: "Limpando a URL do servidor padrão do desktop",
    },
    {
      depth: 4,
      slug: "removendo-serverport--serverhostname-da-sua-configuração",
      text: "Removendo server.port / server.hostname da sua configuração",
    },
    {
      depth: 4,
      slug: "verificando-as-variáveis-de-ambiente",
      text: "Verificando as variáveis de ambiente",
    },
    {
      depth: 3,
      slug: "linux-problemas-com-wayland--x11",
      text: "Linux: Problemas com Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-runtime-do-webview2",
      text: "Windows: Runtime do WebView2",
    },
    {
      depth: 3,
      slug: "windows-problemas-gerais-de-desempenho",
      text: "Windows: Problemas gerais de desempenho",
    },
    {
      depth: 3,
      slug: "notificações-não-aparecendo",
      text: "Notificações não aparecendo",
    },
    {
      depth: 3,
      slug: "redefinindo-o-armazenamento-do-aplicativo-de-desktop-último-recurso",
      text: "Redefinindo o armazenamento do aplicativo de desktop (último recurso)",
    },
    {
      depth: 2,
      slug: "obtendo-ajuda",
      text: "Obtendo ajuda",
    },
    {
      depth: 2,
      slug: "problemas-comuns",
      text: "Problemas comuns",
    },
    {
      depth: 3,
      slug: "o-slopcode-não-inicia",
      text: "O slopcode não inicia",
    },
    {
      depth: 3,
      slug: "problemas-de-autenticação",
      text: "Problemas de autenticação",
    },
    {
      depth: 3,
      slug: "modelo-não-disponível",
      text: "Modelo não disponível",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-e-problemas-com-pacotes-de-provedores",
      text: "AI_APICallError e problemas com pacotes de provedores",
    },
    {
      depth: 3,
      slug: "copiarcolar-não-funciona-no-linux",
      text: "Copiar/colar não funciona no Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Para depurar problemas com o slopcode, comece verificando os logs e os dados locais que ele armazena no disco.</p>\n<hr>\n<h2 id="logs"><a href="#logs">Logs</a></h2>\n<p>Os arquivos de log são gravados em:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> e cole <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Os arquivos de log são nomeados com timestamps (por exemplo, <code dir="auto">2025-01-09T123456.log</code>) e os 10 arquivos de log mais recentes são mantidos.</p>\n<p>Você pode definir o nível de log com a opção de linha de comando <code dir="auto">--log-level</code> para obter informações de depuração mais detalhadas. Por exemplo, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="armazenamento"><a href="#armazenamento">Armazenamento</a></h2>\n<p>O slopcode armazena dados de sessão e outros dados do aplicativo no disco em:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> e cole <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Este diretório contém:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Dados de autenticação como chaves de API, tokens OAuth</li>\n<li><code dir="auto">log/</code> - Logs do aplicativo</li>\n<li><code dir="auto">project/</code> - Dados específicos do projeto, como dados de sessão e mensagens\n<ul>\n<li>Se o projeto estiver dentro de um repositório Git, ele é armazenado em <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Se não for um repositório Git, ele é armazenado em <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="aplicativo-de-desktop"><a href="#aplicativo-de-desktop">Aplicativo de Desktop</a></h2>\n<p>O slopcode Desktop executa um servidor slopcode local (o sidecar <code dir="auto">slopcode-cli</code>) em segundo plano. A maioria dos problemas é causada por um plugin com mau funcionamento, um cache corrompido ou uma configuração de servidor incorreta.</p>\n<h3 id="verificações-rápidas"><a href="#verificações-rápidas">Verificações rápidas</a></h3>\n<ul>\n<li>Saia completamente do aplicativo e reinicie-o.</li>\n<li>Se o aplicativo mostrar uma tela de erro, clique em <strong>Reiniciar</strong> e copie os detalhes do erro.</li>\n<li>Apenas macOS: menu <code dir="auto">SlopCode</code> -> <strong>Recarregar Webview</strong> (ajuda se a interface estiver em branco/congelada).</li>\n</ul>\n<hr>\n<h3 id="desativando-plugins"><a href="#desativando-plugins">Desativando plugins</a></h3>\n<p>Se o aplicativo de desktop estiver travando ao iniciar, pendurado ou se comportando de maneira estranha, comece desativando os plugins.</p>\n<h4 id="verificando-a-configuração-global"><a href="#verificando-a-configuração-global">Verificando a configuração global</a></h4>\n<p>Abra seu arquivo de configuração global e procure uma chave <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (ou <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (instalações mais antigas): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> e cole <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Se você tiver plugins configurados, desative-os temporariamente removendo a chave ou definindo-a como um array vazio:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="verificando-os-diretórios-de-plugins"><a href="#verificando-os-diretórios-de-plugins">Verificando os diretórios de plugins</a></h4>\n<p>O slopcode também pode carregar plugins locais do disco. Mova-os temporariamente para fora do caminho (ou renomeie a pasta) e reinicie o aplicativo de desktop:</p>\n<ul>\n<li><strong>Plugins globais</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> e cole <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Plugins de projeto</strong> (apenas se você usar configuração por projeto)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Se o aplicativo voltar a funcionar, reative os plugins um por um para descobrir qual está causando o problema.</p>\n<hr>\n<h3 id="limpando-o-cache"><a href="#limpando-o-cache">Limpando o cache</a></h3>\n<p>Se desativar plugins não ajudar (ou se a instalação de um plugin estiver travada), limpe o cache para que o slopcode possa reconstruí-lo.</p>\n<ol>\n<li>Saia completamente do slopcode Desktop.</li>\n<li>Exclua o diretório de cache:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> cole <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: exclua <code dir="auto">~/.cache/slopcode</code> (ou execute <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> e cole <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Reinicie o slopcode Desktop.</li>\n</ol>\n<hr>\n<h3 id="corrigindo-problemas-de-conexão-com-o-servidor"><a href="#corrigindo-problemas-de-conexão-com-o-servidor">Corrigindo problemas de conexão com o servidor</a></h3>\n<p>O slopcode Desktop pode iniciar seu próprio servidor local (padrão) ou conectar-se a uma URL de servidor que você configurou.</p>\n<p>Se você ver um diálogo <strong>“Conexão Falhou”</strong> (ou o aplicativo nunca passa da tela de inicialização), verifique se há uma URL de servidor personalizada.</p>\n<h4 id="limpando-a-url-do-servidor-padrão-do-desktop"><a href="#limpando-a-url-do-servidor-padrão-do-desktop">Limpando a URL do servidor padrão do desktop</a></h4>\n<p>Na tela inicial, clique no nome do servidor (com o ponto de status) para abrir o seletor de Servidor. Na seção <strong>Servidor padrão</strong>, clique em <strong>Limpar</strong>.</p>\n<h4 id="removendo-serverport--serverhostname-da-sua-configuração"><a href="#removendo-serverport--serverhostname-da-sua-configuração">Removendo <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> da sua configuração</a></h4>\n<p>Se seu <code dir="auto">slopcode.json(c)</code> contiver uma seção <code dir="auto">server</code>, remova-a temporariamente e reinicie o aplicativo de desktop.</p>\n<h4 id="verificando-as-variáveis-de-ambiente"><a href="#verificando-as-variáveis-de-ambiente">Verificando as variáveis de ambiente</a></h4>\n<p>Se você tiver <code dir="auto">SLOPCODE_PORT</code> definido em seu ambiente, o aplicativo de desktop tentará usar essa porta para o servidor local.</p>\n<ul>\n<li>Desfaça <code dir="auto">SLOPCODE_PORT</code> (ou escolha uma porta livre) e reinicie.</li>\n</ul>\n<hr>\n<h3 id="linux-problemas-com-wayland--x11"><a href="#linux-problemas-com-wayland--x11">Linux: Problemas com Wayland / X11</a></h3>\n<p>No Linux, algumas configurações do Wayland podem causar janelas em branco ou erros de compositor.</p>\n<ul>\n<li>Se você estiver no Wayland e o aplicativo estiver em branco/travando, tente iniciar com <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Se isso piorar as coisas, remova e tente iniciar sob uma sessão X11.</li>\n</ul>\n<hr>\n<h3 id="windows-runtime-do-webview2"><a href="#windows-runtime-do-webview2">Windows: Runtime do WebView2</a></h3>\n<p>No Windows, o slopcode Desktop requer o <strong>WebView2 Runtime</strong> do Microsoft Edge. Se o aplicativo abrir em uma janela em branco ou não iniciar, instale/atualize o WebView2 e tente novamente.</p>\n<hr>\n<h3 id="windows-problemas-gerais-de-desempenho"><a href="#windows-problemas-gerais-de-desempenho">Windows: Problemas gerais de desempenho</a></h3>\n<p>Se você estiver enfrentando desempenho lento, problemas de acesso a arquivos ou problemas no terminal no Windows, tente usar <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>. O WSL fornece um ambiente Linux que funciona de forma mais integrada com os recursos do slopcode.</p>\n<hr>\n<h3 id="notificações-não-aparecendo"><a href="#notificações-não-aparecendo">Notificações não aparecendo</a></h3>\n<p>O slopcode Desktop só mostra notificações do sistema quando:</p>\n<ul>\n<li>as notificações estão habilitadas para o slopcode nas configurações do seu sistema operacional, e</li>\n<li>a janela do aplicativo não está focada.</li>\n</ul>\n<hr>\n<h3 id="redefinindo-o-armazenamento-do-aplicativo-de-desktop-último-recurso"><a href="#redefinindo-o-armazenamento-do-aplicativo-de-desktop-último-recurso">Redefinindo o armazenamento do aplicativo de desktop (último recurso)</a></h3>\n<p>Se o aplicativo não iniciar e você não conseguir limpar as configurações pela interface, redefina o estado salvo do aplicativo de desktop.</p>\n<ol>\n<li>Saia do slopcode Desktop.</li>\n<li>Encontre e exclua estes arquivos (eles estão no diretório de dados do aplicativo slopcode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (URL do servidor padrão do desktop)</li>\n<li><code dir="auto">slopcode.global.dat</code> e <code dir="auto">slopcode.workspace.*.dat</code> (estado da interface como servidores/projetos recentes)</li>\n</ul>\n<p>Para encontrar o diretório rapidamente:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (depois pesquise pelos nomes dos arquivos acima)</li>\n<li><strong>Linux</strong>: pesquise em <code dir="auto">~/.local/share</code> pelos nomes dos arquivos acima</li>\n<li><strong>Windows</strong>: Pressione <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (depois pesquise pelos nomes dos arquivos acima)</li>\n</ul>\n<hr>\n<h2 id="obtendo-ajuda"><a href="#obtendo-ajuda">Obtendo ajuda</a></h2>\n<p>Se você estiver enfrentando problemas com o slopcode:</p>\n<ol>\n<li>\n<p><strong>Relatar problemas no GitHub</strong></p>\n<p>A melhor maneira de relatar bugs ou solicitar recursos é através do nosso repositório no GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Antes de criar um novo problema, pesquise problemas existentes para ver se seu problema já foi relatado.</p>\n</li>\n<li>\n<p><strong>Junte-se ao nosso Discord</strong></p>\n<p>Para ajuda em tempo real e discussão da comunidade, junte-se ao nosso servidor Discord:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="problemas-comuns"><a href="#problemas-comuns">Problemas comuns</a></h2>\n<p>Aqui estão alguns problemas comuns e como resolvê-los.</p>\n<hr>\n<h3 id="o-slopcode-não-inicia"><a href="#o-slopcode-não-inicia">O slopcode não inicia</a></h3>\n<ol>\n<li>Verifique os logs em busca de mensagens de erro</li>\n<li>Tente executar com <code dir="auto">--print-logs</code> para ver a saída no terminal</li>\n<li>Certifique-se de que você tem a versão mais recente com <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problemas-de-autenticação"><a href="#problemas-de-autenticação">Problemas de autenticação</a></h3>\n<ol>\n<li>Tente reautenticar com o comando <code dir="auto">/connect</code> na TUI</li>\n<li>Verifique se suas chaves de API são válidas</li>\n<li>Certifique-se de que sua rede permite conexões com a API do provedor</li>\n</ol>\n<hr>\n<h3 id="modelo-não-disponível"><a href="#modelo-não-disponível">Modelo não disponível</a></h3>\n<ol>\n<li>Verifique se você se autenticou com o provedor</li>\n<li>Verifique se o nome do modelo em sua configuração está correto</li>\n<li>Alguns modelos podem exigir acesso ou assinaturas específicas</li>\n</ol>\n<p>Se você encontrar <code dir="auto">ProviderModelNotFoundError</code>, é mais provável que você esteja referenciando um modelo incorretamente em algum lugar.\nOs modelos devem ser referenciados assim: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Exemplos:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Para descobrir quais modelos você tem acesso, execute <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Se você encontrar um ProviderInitError, provavelmente você tem uma configuração inválida ou corrompida.</p>\n<p>Para resolver isso:</p>\n<ol>\n<li>\n<p>Primeiro, verifique se seu provedor está configurado corretamente seguindo o <a href="/docs/providers">guia de provedores</a></p>\n</li>\n<li>\n<p>Se o problema persistir, tente limpar sua configuração armazenada:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>No Windows, pressione <code dir="auto">WIN+R</code> e exclua: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Reautentique-se com seu provedor usando o comando <code dir="auto">/connect</code> na TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-e-problemas-com-pacotes-de-provedores"><a href="#ai_apicallerror-e-problemas-com-pacotes-de-provedores">AI_APICallError e problemas com pacotes de provedores</a></h3>\n<p>Se você encontrar erros de chamada de API, isso pode ser devido a pacotes de provedores desatualizados. O slopcode instala dinamicamente pacotes de provedores (OpenAI, Anthropic, Google, etc.) conforme necessário e os armazena em cache localmente.</p>\n<p>Para resolver problemas com pacotes de provedores:</p>\n<ol>\n<li>\n<p>Limpe o cache do pacote de provedores:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>No Windows, pressione <code dir="auto">WIN+R</code> e exclua: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Reinicie o slopcode para reinstalar os pacotes de provedores mais recentes</p>\n</li>\n</ol>\n<p>Isso forçará o slopcode a baixar as versões mais recentes dos pacotes de provedores, o que muitas vezes resolve problemas de compatibilidade com parâmetros de modelo e alterações na API.</p>\n<hr>\n<h3 id="copiarcolar-não-funciona-no-linux"><a href="#copiarcolar-não-funciona-no-linux">Copiar/colar não funciona no Linux</a></h3>\n<p>Usuários do Linux precisam ter um dos seguintes utilitários de área de transferência instalados para que a funcionalidade de copiar/colar funcione:</p>\n<p><strong>Para sistemas X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Para sistemas Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Para ambientes sem cabeça:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>O slopcode detectará se você está usando Wayland e preferirá <code dir="auto">wl-clipboard</code>, caso contrário, tentará encontrar ferramentas de área de transferência na ordem: <code dir="auto">xclip</code> e <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/pt-br/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/pt-br/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
