globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "生态系统",
  description: "基于 SlopCode 构建的项目与集成。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "插件",
      text: "插件",
    },
    {
      depth: 2,
      slug: "项目",
      text: "项目",
    },
    {
      depth: 2,
      slug: "代理",
      text: "代理",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>基于 SlopCode 构建的社区项目合集。</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>想将您的 SlopCode 相关项目添加到此列表中？欢迎提交 PR。</p></div></aside>\n<p>您还可以查看 <a href="https://github.com/awesome-slopcode/awesome-slopcode">awesome-slopcode</a> 和 <a href="https://slopcode.cafe">slopcode.cafe</a>，这是一个聚合生态系统与社区资源的社区。</p>\n<hr>\n<h2 id="插件"><a href="#插件">插件</a></h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>名称</th><th>描述</th></tr></thead><tbody><tr><td><a href="https://github.com/jamesmurdza/daytona/blob/main/guides/typescript/slopcode/README.md">slopcode-daytona</a></td><td>在隔离的 Daytona 沙箱中自动运行 SlopCode 会话，支持 git 同步和实时预览</td></tr><tr><td><a href="https://github.com/H2Shami/slopcode-helicone-session">slopcode-helicone-session</a></td><td>自动注入 Helicone 会话头信息，用于请求分组</td></tr><tr><td><a href="https://github.com/nick-vi/slopcode-type-inject">slopcode-type-inject</a></td><td>通过查找工具自动将 TypeScript/Svelte 类型注入到文件读取中</td></tr><tr><td><a href="https://github.com/numman-ali/slopcode-openai-codex-auth">slopcode-openai-codex-auth</a></td><td>使用您的 ChatGPT Plus/Pro 订阅替代 API 额度</td></tr><tr><td><a href="https://github.com/jenslys/slopcode-gemini-auth">slopcode-gemini-auth</a></td><td>使用您现有的 Gemini 套餐替代 API 计费</td></tr><tr><td><a href="https://github.com/NoeFabris/slopcode-antigravity-auth">slopcode-antigravity-auth</a></td><td>使用 Antigravity 的免费模型替代 API 计费</td></tr><tr><td><a href="https://github.com/athal7/slopcode-devcontainers">slopcode-devcontainers</a></td><td>多分支开发容器隔离，支持浅克隆和自动分配端口</td></tr><tr><td><a href="https://github.com/shekohex/slopcode-google-antigravity-auth">slopcode-google-antigravity-auth</a></td><td>Google Antigravity OAuth 插件，支持 Google 搜索及更强健的 API 处理</td></tr><tr><td><a href="https://github.com/Tarquinen/slopcode-dynamic-context-pruning">slopcode-dynamic-context-pruning</a></td><td>通过修剪过时的工具输出来优化 Token 使用</td></tr><tr><td><a href="https://github.com/ghoulr/slopcode-websearch-cited.git">slopcode-websearch-cited</a></td><td>为受支持的提供商添加原生网页搜索支持，采用 Google grounded 风格</td></tr><tr><td><a href="https://github.com/shekohex/slopcode-pty.git">slopcode-pty</a></td><td>使 AI 代理能够在 PTY 中运行后台进程，并向其发送交互式输入</td></tr><tr><td><a href="https://github.com/JRedeker/slopcode-shell-strategy">slopcode-shell-strategy</a></td><td>非交互式 shell 命令指令——防止依赖 TTY 的操作导致挂起</td></tr><tr><td><a href="https://github.com/angristan/slopcode-wakatime">slopcode-wakatime</a></td><td>使用 Wakatime 追踪 SlopCode 的使用情况</td></tr><tr><td><a href="https://github.com/franlol/slopcode-md-table-formatter/tree/main">slopcode-md-table-formatter</a></td><td>清理 LLM 生成的 Markdown 表格</td></tr><tr><td><a href="https://github.com/JRedeker/slopcode-morph-fast-apply">slopcode-morph-fast-apply</a></td><td>通过 Morph Fast Apply API 和惰性编辑标记实现 10 倍更快的代码编辑</td></tr><tr><td><a href="https://github.com/code-yeongyu/oh-my-slopcode">oh-my-slopcode</a></td><td>后台代理、预构建的 LSP/AST/MCP 工具、精选代理，兼容 Claude Code</td></tr><tr><td><a href="https://github.com/panta82/slopcode-notificator">slopcode-notificator</a></td><td>SlopCode 会话的桌面通知和声音提醒</td></tr><tr><td><a href="https://github.com/mohak34/slopcode-notifier">slopcode-notifier</a></td><td>针对权限请求、任务完成和错误事件的桌面通知与声音提醒</td></tr><tr><td><a href="https://github.com/24601/slopcode-zellij-namer">slopcode-zellij-namer</a></td><td>基于 SlopCode 上下文的 AI 驱动自动 Zellij 会话命名</td></tr><tr><td><a href="https://github.com/zenobi-us/slopcode-skillful">slopcode-skillful</a></td><td>允许 SlopCode 代理通过技能发现和注入按需延迟加载提示词</td></tr><tr><td><a href="https://github.com/supermemoryai/slopcode-supermemory">slopcode-supermemory</a></td><td>使用 Supermemory 实现跨会话的持久记忆</td></tr><tr><td><a href="https://github.com/backnotprop/plannotator/tree/main/apps/slopcode-plugin">@plannotator/slopcode</a></td><td>支持可视化标注和私有/离线分享的交互式计划审查</td></tr><tr><td><a href="https://github.com/spoons-and-mirrors/subtask2">@openspoon/subtask2</a></td><td>将 SlopCode /commands 扩展为具有精细流程控制的强大编排系统</td></tr><tr><td><a href="https://github.com/different-ai/slopcode-scheduler">slopcode-scheduler</a></td><td>使用 cron 语法通过 launchd (Mac) 或 systemd (Linux) 调度周期性任务</td></tr><tr><td><a href="https://github.com/vtemian/micode">micode</a></td><td>结构化的头脑风暴 → 计划 → 实现工作流，支持会话连续性</td></tr><tr><td><a href="https://github.com/vtemian/octto">octto</a></td><td>用于 AI 头脑风暴的交互式浏览器 UI，支持多问题表单</td></tr><tr><td><a href="https://github.com/kdcokenny/slopcode-background-agents">slopcode-background-agents</a></td><td>Claude Code 风格的后台代理，支持异步委托和上下文持久化</td></tr><tr><td><a href="https://github.com/kdcokenny/slopcode-notify">slopcode-notify</a></td><td>SlopCode 的原生操作系统通知——随时了解任务完成情况</td></tr><tr><td><a href="https://github.com/kdcokenny/slopcode-workspace">slopcode-workspace</a></td><td>捆绑式多代理编排套件——16 个组件，一次安装</td></tr><tr><td><a href="https://github.com/kdcokenny/slopcode-worktree">slopcode-worktree</a></td><td>SlopCode 的零摩擦 git worktree 管理</td></tr></tbody></table>\n<hr>\n<h2 id="项目"><a href="#项目">项目</a></h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>名称</th><th>描述</th></tr></thead><tbody><tr><td><a href="https://github.com/remorses/kimaki">kimaki</a></td><td>用于控制 SlopCode 会话的 Discord 机器人，基于 SDK 构建</td></tr><tr><td><a href="https://github.com/NickvanDyke/slopcode.nvim">slopcode.nvim</a></td><td>Neovim 插件，提供编辑器感知的提示词，基于 API 构建</td></tr><tr><td><a href="https://github.com/hosenur/portal">portal</a></td><td>通过 Tailscale/VPN 使用的移动优先 SlopCode Web UI</td></tr><tr><td><a href="https://github.com/zenobi-us/slopcode-plugin-template/">slopcode plugin template</a></td><td>用于构建 SlopCode 插件的模板</td></tr><tr><td><a href="https://github.com/sudo-tee/slopcode.nvim">slopcode.nvim</a></td><td>SlopCode 的 Neovim 前端——基于终端的 AI 编码代理</td></tr><tr><td><a href="https://github.com/ben-vargas/ai-sdk-provider-slopcode-sdk">ai-sdk-provider-slopcode-sdk</a></td><td>Vercel AI SDK 提供商，用于通过 @slopcode-ai/sdk 使用 SlopCode</td></tr><tr><td><a href="https://github.com/btriapitsyn/openchamber">OpenChamber</a></td><td>SlopCode 的 Web / 桌面应用和 VS Code 扩展</td></tr><tr><td><a href="https://github.com/mtymek/slopcode-obsidian">SlopCode-Obsidian</a></td><td>将 SlopCode 嵌入 Obsidian UI 的 Obsidian 插件</td></tr><tr><td><a href="https://github.com/different-ai/openwork">OpenWork</a></td><td>Claude Cowork 的开源替代方案，由 SlopCode 驱动</td></tr><tr><td><a href="https://github.com/kdcokenny/ocx">ocx</a></td><td>SlopCode 扩展管理器，支持可移植的隔离配置</td></tr><tr><td><a href="https://github.com/NeuralNomadsAI/CodeNomad">CodeNomad</a></td><td>SlopCode 的桌面、Web、移动和远程客户端应用</td></tr></tbody></table>\n<hr>\n<h2 id="代理"><a href="#代理">代理</a></h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>名称</th><th>描述</th></tr></thead><tbody><tr><td><a href="https://github.com/Cluster444/agentic">Agentic</a></td><td>用于结构化开发的模块化 AI 代理和命令</td></tr><tr><td><a href="https://github.com/darrenhinde/slopcode-agents">slopcode-agents</a></td><td>用于增强工作流的配置、提示词、代理和插件</td></tr></tbody></table>',
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
const url = "src/content/docs/zh-cn/ecosystem.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ecosystem.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/ecosystem.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
