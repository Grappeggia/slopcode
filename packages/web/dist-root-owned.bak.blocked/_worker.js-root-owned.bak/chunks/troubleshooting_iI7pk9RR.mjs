globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Dépannage",
  description: "Problèmes courants et comment les résoudre.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "journaux",
      text: "Journaux",
    },
    {
      depth: 2,
      slug: "stockage",
      text: "Stockage",
    },
    {
      depth: 2,
      slug: "application-de-bureau",
      text: "Application de bureau",
    },
    {
      depth: 3,
      slug: "vérifications-rapides",
      text: "Vérifications rapides",
    },
    {
      depth: 3,
      slug: "désactiver-les-plugins",
      text: "Désactiver les plugins",
    },
    {
      depth: 4,
      slug: "vérifiez-la-configuration-globale",
      text: "Vérifiez la configuration globale",
    },
    {
      depth: 4,
      slug: "vérifiez-les-répertoires-des-plugins",
      text: "Vérifiez les répertoires des plugins",
    },
    {
      depth: 3,
      slug: "vider-le-cache",
      text: "Vider le cache",
    },
    {
      depth: 3,
      slug: "résoudre-les-problèmes-de-connexion-au-serveur",
      text: "Résoudre les problèmes de connexion au serveur",
    },
    {
      depth: 4,
      slug: "effacer-le-serveur-par-défaut-du-bureau-url",
      text: "Effacer le serveur par défaut du bureau URL",
    },
    {
      depth: 4,
      slug: "supprimez-serverport--serverhostname-de-votre-configuration",
      text: "Supprimez server.port / server.hostname de votre configuration",
    },
    {
      depth: 4,
      slug: "vérifier-les-variables-denvironnement",
      text: "Vérifier les variables d’environnement",
    },
    {
      depth: 3,
      slug: "linux-problèmes-wayland--x11",
      text: "Linux : Problèmes Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-exécution-webview2",
      text: "Windows : exécution WebView2",
    },
    {
      depth: 3,
      slug: "windows-problèmes-de-performances-généraux",
      text: "Windows : problèmes de performances généraux",
    },
    {
      depth: 3,
      slug: "les-notifications-ne-saffichent-pas",
      text: "Les notifications ne s’affichent pas",
    },
    {
      depth: 3,
      slug: "réinitialiser-le-stockage-des-applications-de-bureau-dernier-recours",
      text: "Réinitialiser le stockage des applications de bureau (dernier recours)",
    },
    {
      depth: 2,
      slug: "obtenir-de-laide",
      text: "Obtenir de l’aide",
    },
    {
      depth: 2,
      slug: "problèmes-courants",
      text: "Problèmes courants",
    },
    {
      depth: 3,
      slug: "slopcode-ne-démarre-pas",
      text: "SlopCode ne démarre pas",
    },
    {
      depth: 3,
      slug: "problèmes-dauthentification",
      text: "Problèmes d’authentification",
    },
    {
      depth: 3,
      slug: "modèle-non-disponible",
      text: "Modèle non disponible",
    },
    {
      depth: 3,
      slug: "erreurinit-du-fournisseur",
      text: "ErreurInit du fournisseur",
    },
    {
      depth: 3,
      slug: "problèmes-liés-à-ai_apicallerror-et-au-package-du-fournisseur",
      text: "Problèmes liés à AI_APICallError et au package du fournisseur",
    },
    {
      depth: 3,
      slug: "le-copiercoller-ne-fonctionne-pas-sur-linux",
      text: "Le copier/coller ne fonctionne pas sur Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Pour déboguer les problèmes avec SlopCode, commencez par vérifier les journaux et les données locales qu’il stocke sur le disque.</p>\n<hr>\n<h2 id="journaux"><a href="#journaux">Journaux</a></h2>\n<p>Les fichiers journaux sont écrits dans :</p>\n<ul>\n<li><strong>macOS/Linux</strong> : <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> et collez <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Les fichiers journaux sont nommés avec des horodatages (par exemple, <code dir="auto">2025-01-09T123456.log</code>) et les 10 fichiers journaux les plus récents sont conservés.</p>\n<p>Vous pouvez définir le niveau de journalisation avec l’option de ligne de commande <code dir="auto">--log-level</code> pour obtenir des informations de débogage plus détaillées. Par exemple, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="stockage"><a href="#stockage">Stockage</a></h2>\n<p>slopcode stocke les données de session et autres données d’application sur le disque à l’emplacement :</p>\n<ul>\n<li><strong>macOS/Linux</strong> : <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> et collez <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Ce répertoire contient :</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Données d’authentification telles que les clés API, les jetons OAuth</li>\n<li><code dir="auto">log/</code> - Journaux d’applications</li>\n<li><code dir="auto">project/</code> - Données spécifiques au projet telles que les données de session et de message\n<ul>\n<li>Si le projet se trouve dans un dépôt Git, il est stocké dans <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>S’il ne s’agit pas d’un dépôt Git, il est stocké dans <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="application-de-bureau"><a href="#application-de-bureau">Application de bureau</a></h2>\n<p>SlopCode Desktop exécute un serveur SlopCode local (le side-car <code dir="auto">slopcode-cli</code>) en arrière-plan. La plupart des problèmes sont causés par un plugin qui se comporte mal, un cache corrompu ou un mauvais paramètre du serveur.</p>\n<h3 id="vérifications-rapides"><a href="#vérifications-rapides">Vérifications rapides</a></h3>\n<ul>\n<li>Quittez complètement et relancez l’application.</li>\n<li>Si l’application affiche un écran d’erreur, cliquez sur <strong>Redémarrer</strong> et copiez les détails de l’erreur.</li>\n<li>macOS uniquement : menu <code dir="auto">SlopCode</code> -> <strong>Recharger la vue Web</strong> (aide si l’interface utilisateur est vide/gelée).</li>\n</ul>\n<hr>\n<h3 id="désactiver-les-plugins"><a href="#désactiver-les-plugins">Désactiver les plugins</a></h3>\n<p>Si l’application de bureau plante au lancement, se bloque ou se comporte étrangement, commencez par désactiver les plugins.</p>\n<h4 id="vérifiez-la-configuration-globale"><a href="#vérifiez-la-configuration-globale">Vérifiez la configuration globale</a></h4>\n<p>Ouvrez votre fichier de configuration global et recherchez une clé <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong> : <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (ou <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (anciennes installations) : <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> et collez <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Si vous avez configuré des plugins, désactivez-les temporairement en supprimant la clé ou en la définissant sur un tableau vide :</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="vérifiez-les-répertoires-des-plugins"><a href="#vérifiez-les-répertoires-des-plugins">Vérifiez les répertoires des plugins</a></h4>\n<p>SlopCode peut également charger des plugins locaux à partir du disque. Écartez-les temporairement (ou renommez le dossier) et redémarrez l’application de bureau :</p>\n<ul>\n<li><strong>Plugins mondiaux</strong>\n<ul>\n<li><strong>macOS/Linux</strong> : <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> et collez <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Plugins de projet</strong> (uniquement si vous utilisez une configuration par projet)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Si l’application recommence à fonctionner, réactivez les plugins un par un pour trouver celui à l’origine du problème.</p>\n<hr>\n<h3 id="vider-le-cache"><a href="#vider-le-cache">Vider le cache</a></h3>\n<p>Si la désactivation des plugins ne résout pas le problème (ou si l’installation d’un plugin est bloquée), videz le cache afin que SlopCode puisse le reconstruire.</p>\n<ol>\n<li>Quittez complètement SlopCode Desktop.</li>\n<li>Supprimez le répertoire cache :</li>\n</ol>\n<ul>\n<li><strong>macOS</strong> : Finder -> <code dir="auto">Cmd+Shift+G</code> -> coller <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong> : supprimez <code dir="auto">~/.cache/slopcode</code> (ou exécutez <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> et collez <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Redémarrez le bureau SlopCode.</li>\n</ol>\n<hr>\n<h3 id="résoudre-les-problèmes-de-connexion-au-serveur"><a href="#résoudre-les-problèmes-de-connexion-au-serveur">Résoudre les problèmes de connexion au serveur</a></h3>\n<p>SlopCode Desktop peut soit démarrer son propre serveur local (par défaut), soit se connecter à un serveur URL que vous avez configuré.</p>\n<p>Si vous voyez une boîte de dialogue <strong>« Échec de la connexion »</strong> (ou si l’application ne dépasse jamais l’écran de démarrage), recherchez un serveur personnalisé URL.</p>\n<h4 id="effacer-le-serveur-par-défaut-du-bureau-url"><a href="#effacer-le-serveur-par-défaut-du-bureau-url">Effacer le serveur par défaut du bureau URL</a></h4>\n<p>Depuis l’écran d’accueil, cliquez sur le nom du serveur (avec le point d’état) pour ouvrir le sélecteur de serveur. Dans la section <strong>Serveur par défaut</strong>, cliquez sur <strong>Effacer</strong>.</p>\n<h4 id="supprimez-serverport--serverhostname-de-votre-configuration"><a href="#supprimez-serverport--serverhostname-de-votre-configuration">Supprimez <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> de votre configuration</a></h4>\n<p>Si votre <code dir="auto">slopcode.json(c)</code> contient une section <code dir="auto">server</code>, supprimez-la temporairement et redémarrez l’application de bureau.</p>\n<h4 id="vérifier-les-variables-denvironnement"><a href="#vérifier-les-variables-denvironnement">Vérifier les variables d’environnement</a></h4>\n<p>Si <code dir="auto">SLOPCODE_PORT</code> est défini dans votre environnement, l’application de bureau tentera d’utiliser ce port pour le serveur local.</p>\n<ul>\n<li>Désactivez <code dir="auto">SLOPCODE_PORT</code> (ou choisissez un port libre) et redémarrez.</li>\n</ul>\n<hr>\n<h3 id="linux-problèmes-wayland--x11"><a href="#linux-problèmes-wayland--x11">Linux : Problèmes Wayland / X11</a></h3>\n<p>Sur Linux, certaines configurations Wayland peuvent provoquer des fenêtres vides ou des erreurs de composition.</p>\n<ul>\n<li>Si vous êtes sur Wayland et que l’application est vide/plante, essayez de la lancer avec <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Si cela aggrave les choses, supprimez-le et essayez plutôt de le lancer sous une session X11.</li>\n</ul>\n<hr>\n<h3 id="windows-exécution-webview2"><a href="#windows-exécution-webview2">Windows : exécution WebView2</a></h3>\n<p>Sur Windows, SlopCode Desktop nécessite Microsoft Edge <strong>WebView2 Runtime</strong>. Si l’application s’ouvre sur une fenêtre vide ou ne démarre pas, installez/mettez à jour WebView2 et réessayez.</p>\n<hr>\n<h3 id="windows-problèmes-de-performances-généraux"><a href="#windows-problèmes-de-performances-généraux">Windows : problèmes de performances généraux</a></h3>\n<p>Si vous rencontrez des performances lentes, des problèmes d’accès aux fichiers ou des problèmes de terminal sur Windows, essayez d’utiliser <a href="/docs/windows-wsl">WSL (Windows Sous-système pour Linux)</a>. WSL fournit un environnement Linux qui fonctionne de manière plus transparente avec les fonctionnalités de SlopCode.</p>\n<hr>\n<h3 id="les-notifications-ne-saffichent-pas"><a href="#les-notifications-ne-saffichent-pas">Les notifications ne s’affichent pas</a></h3>\n<p>SlopCode Desktop affiche uniquement les notifications système lorsque :</p>\n<ul>\n<li>les notifications sont activées pour SlopCode dans les paramètres de votre système d’exploitation, et</li>\n<li>la fenêtre de l’application n’est pas ciblée.</li>\n</ul>\n<hr>\n<h3 id="réinitialiser-le-stockage-des-applications-de-bureau-dernier-recours"><a href="#réinitialiser-le-stockage-des-applications-de-bureau-dernier-recours">Réinitialiser le stockage des applications de bureau (dernier recours)</a></h3>\n<p>Si l’application ne démarre pas et que vous ne pouvez pas effacer les paramètres depuis l’interface utilisateur, réinitialisez l’état enregistré de l’application de bureau.</p>\n<ol>\n<li>Quittez le bureau SlopCode.</li>\n<li>Recherchez et supprimez ces fichiers (ils se trouvent dans le répertoire de données de l’application SlopCode Desktop) :</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (serveur de bureau par défaut URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> et <code dir="auto">slopcode.workspace.*.dat</code> (état de l’interface utilisateur comme les serveurs/projets récents)</li>\n</ul>\n<p>Pour trouver rapidement le répertoire :</p>\n<ul>\n<li><strong>macOS</strong> : Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (puis recherchez les noms de fichiers ci-dessus)</li>\n<li><strong>Linux</strong> : recherchez sous <code dir="auto">~/.local/share</code> les noms de fichiers ci-dessus</li>\n<li><strong>Windows</strong> : appuyez sur <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (puis recherchez les noms de fichiers ci-dessus)</li>\n</ul>\n<hr>\n<h2 id="obtenir-de-laide"><a href="#obtenir-de-laide">Obtenir de l’aide</a></h2>\n<p>Si vous rencontrez des problèmes avec SlopCode :</p>\n<ol>\n<li><strong>Signaler les problèmes le GitHub</strong></li>\n</ol>\n<p>La meilleure façon de signaler des bogues ou de demander des fonctionnalités consiste à utiliser notre référentiel GitHub :</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Avant de créer un nouveau problème, recherchez les problèmes existants pour voir si votre problème a déjà été signalé.</p>\n<ol start="2">\n<li><strong>Rejoignez notre Discord</strong></li>\n</ol>\n<p>Pour obtenir de l’aide en temps réel et une discussion communautaire, rejoignez notre serveur Discord :</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n<hr>\n<h2 id="problèmes-courants"><a href="#problèmes-courants">Problèmes courants</a></h2>\n<p>Voici quelques problèmes courants et comment les résoudre.</p>\n<hr>\n<h3 id="slopcode-ne-démarre-pas"><a href="#slopcode-ne-démarre-pas">SlopCode ne démarre pas</a></h3>\n<ol>\n<li>Vérifiez les journaux pour les messages d’erreur</li>\n<li>Essayez d’exécuter avec <code dir="auto">--print-logs</code> pour voir la sortie dans le terminal</li>\n<li>Assurez-vous d’avoir la dernière version avec <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problèmes-dauthentification"><a href="#problèmes-dauthentification">Problèmes d’authentification</a></h3>\n<ol>\n<li>Essayez de vous réauthentifier avec la commande <code dir="auto">/connect</code> dans le TUI</li>\n<li>Vérifiez que vos clés API sont valides</li>\n<li>Assurez-vous que votre réseau autorise les connexions au API du fournisseur.</li>\n</ol>\n<hr>\n<h3 id="modèle-non-disponible"><a href="#modèle-non-disponible">Modèle non disponible</a></h3>\n<ol>\n<li>Vérifiez que vous êtes authentifié auprès du fournisseur</li>\n<li>Vérifiez que le nom du modèle dans votre configuration est correct</li>\n<li>Certains modèles peuvent nécessiter un accès ou des abonnements spécifiques</li>\n</ol>\n<p>Si vous rencontrez <code dir="auto">ProviderModelNotFoundError</code>, vous avez probablement tort\nfaire référence à un modèle quelque part.\nLes modèles doivent être référencés comme suit : <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Exemples :</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Pour déterminer à quels modèles vous avez accès, exécutez <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="erreurinit-du-fournisseur"><a href="#erreurinit-du-fournisseur">ErreurInit du fournisseur</a></h3>\n<p>Si vous rencontrez une ProviderInitError, vous avez probablement une configuration non valide ou corrompue.</p>\n<p>Pour résoudre ce problème :</p>\n<ol>\n<li>\n<p>Tout d’abord, vérifiez que votre fournisseur est correctement configuré en suivant le <a href="/docs/providers">guide du fournisseur</a></p>\n</li>\n<li>\n<p>Si le problème persiste, essayez d’effacer votre configuration stockée :</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n</li>\n</ol>\n<p>Sur Windows, appuyez sur <code dir="auto">WIN+R</code> et supprimez : <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n<ol start="3">\n<li>Ré-authentifiez-vous auprès de votre fournisseur à l’aide de la commande <code dir="auto">/connect</code> dans le TUI.</li>\n</ol>\n<hr>\n<h3 id="problèmes-liés-à-ai_apicallerror-et-au-package-du-fournisseur"><a href="#problèmes-liés-à-ai_apicallerror-et-au-package-du-fournisseur">Problèmes liés à AI_APICallError et au package du fournisseur</a></h3>\n<p>Si vous rencontrez des erreurs d’appel API, cela peut être dû à des packages de fournisseurs obsolètes. slopcode installe dynamiquement les packages du fournisseur (OpenAI, Anthropic, Google, etc.) selon les besoins et les met en cache localement.</p>\n<p>Pour résoudre les problèmes liés au package du fournisseur :</p>\n<ol>\n<li>\n<p>Videz le cache du package du fournisseur :</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n</li>\n</ol>\n<p>Sur Windows, appuyez sur <code dir="auto">WIN+R</code> et supprimez : <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n<ol start="2">\n<li>Redémarrez slopcode pour réinstaller les derniers packages du fournisseur</li>\n</ol>\n<p>Cela forcera slopcode à télécharger les versions les plus récentes des packages du fournisseur, ce qui résout souvent les problèmes de compatibilité avec les paramètres du modèle et les modifications de API.</p>\n<hr>\n<h3 id="le-copiercoller-ne-fonctionne-pas-sur-linux"><a href="#le-copiercoller-ne-fonctionne-pas-sur-linux">Le copier/coller ne fonctionne pas sur Linux</a></h3>\n<p>Les utilisateurs de Linux doivent disposer de l’un des utilitaires de presse-papiers suivants installés pour que la fonctionnalité copier/coller fonctionne :</p>\n<p><strong>Pour les systèmes X11 :</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Pour les systèmes Wayland :</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Pour les environnements sans tête :</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode détectera si vous utilisez Wayland et préférez <code dir="auto">wl-clipboard</code>, sinon il essaiera de trouver les outils du presse-papiers dans l’ordre : <code dir="auto">xclip</code> et <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/fr/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/fr/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/fr/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
