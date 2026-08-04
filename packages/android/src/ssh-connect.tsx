import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import {
  normalizeSshTarget,
  parseSshTarget,
  SSH_AGENTS,
  sshLoginFlow,
  sshLoginGuidance,
  sshSetupRecipe,
  sshProfile,
  validSshPath,
  type SshAgent,
  type SshEvent,
  type SshFolderEntry,
  type SshFolderListing,
  type SshCodexAppServerStatus,
  type SshUpdateCheck,
  type SshSetupAction,
  type SshTransport,
} from "./ssh"
import { canOpenExternalUrl, getAndroidBridge } from "./bridge"
import { installAndroidBack } from "./android-back"
import { appStorage, persistSshWorkspace } from "./platform"
import {
  newerSshVersion,
  readSshUpdateRecord,
  shouldCheckSshUpdate,
  writeSshUpdateRecord,
  type SshUpdatePreference,
} from "./ssh-updates"
import type { SshWorkspaceState } from "./ssh-workspace-state"
import { SshShell } from "./ssh-shell"
import {
  connectedSshWorkspace,
  abandonSshSetup,
  createSshConnectionGate,
  createSshCredentialLoader,
  createSshOnboardingGeneration,
  leaveSshOnboarding,
  resetSshOnboarding,
  type SshConnectAuth,
} from "./ssh-connect-state"

type Props = {
  ssh: SshTransport
  initial?: SshWorkspaceState
  onConnected: (workspace: SshWorkspaceState) => void
}

type Auth = SshConnectAuth
type Step = "auth" | "folder" | "agent"
type Setup = {
  action: SshSetupAction
  reason?: "missing" | "upgrade"
  id?: string
  output: string
  state: "available" | "running" | "failed" | "complete"
}

type AgentStatus = "Ready" | "Needs setup" | "Not installed" | "Checking"

const MAX_SETUP_OUTPUT = 16 * 1024

function agentName(value: SshAgent) {
  if (value === "codex-cli") return "Codex"
  if (value === "opencode-cli") return "OpenCode"
  if (value === "antigravity-cli") return "Antigravity"
  return "Claude Code"
}

function agentDescription(value: SshAgent) {
  if (value === "codex-cli") return "codex / codex exec"
  if (value === "opencode-cli") return "opencode / opencode run"
  if (value === "antigravity-cli") return "agy / Antigravity CLI"
  return "claude / claude -p"
}

function breadcrumbs(path: string) {
  const next = validSshPath(path) ?? "/"
  if (next === "/") return [{ label: "/", path: "/" }]
  let current = ""
  return [
    { label: "/", path: "/" },
    ...next
      .split("/")
      .filter(Boolean)
      .map((label) => {
        current += `/${label}`
        return { label, path: current }
      }),
  ]
}

function formatModified(value: number | undefined) {
  if (value === undefined || value <= 0) return ""
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(value)
}

function formatSize(value: number | undefined) {
  if (value === undefined || value < 0) return ""
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function entryMeta(entry: SshFolderEntry) {
  const kind = entry.type === "directory" ? "Folder" : formatSize(entry.size) || "File"
  const modified = formatModified(entry.modified)
  return modified ? `${kind} · ${modified}` : kind
}

function appendOutput(current: string, next: string) {
  return `${current}${next}`.slice(-MAX_SETUP_OUTPUT)
}

function cleanSetupOutput(value: string) {
  return value
    .replace(/\u001b\]8;[^\u0007]*\u0007/g, (match) => match.match(/https:\/\/[^\u0007]+/)?.[0] ?? "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\([0-9A-Z]/g, "")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
}

function setupUrls(value: string) {
  const urls = [...cleanSetupOutput(value).matchAll(/https:\/\/(?:(?!https:\/\/)[^\s<>()])+/g)]
    .map((item) => item[0].replace(/[.,;:!?]+$/, ""))
    .filter(canOpenExternalUrl)
  const best = new Map<string, { value: string; score: number }>()
  urls.forEach((value) => {
    const url = new URL(value)
    const score = ["client_id", "state", "code_challenge", "redirect_uri", "scope", "user_code"].filter((key) =>
      url.searchParams.has(key),
    ).length
    const key = `${url.origin}${url.pathname}`
    const previous = best.get(key)
    if (!previous || score > previous.score || (score === previous.score && value.length < previous.value.length)) {
      best.set(key, { value, score })
    }
  })
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.value.length - b.value.length)
    .map((item) => item.value)
    .slice(0, 3)
}

function setupCodes(value: string) {
  const output = cleanSetupOutput(value)
  const matches = [
    ...output.matchAll(/(?:enter|use|paste)(?:\s+the)?\s+(?:device\s+)?code\s*:?\s*([A-Z0-9][A-Z0-9-]{3,31})/gi),
    ...output.matchAll(/(?:device|user|verification|authorization)\s+code\s*:?\s*([A-Z0-9][A-Z0-9-]{3,31})/gi),
    ...output.matchAll(/\bcode\s*:\s*([A-Z0-9][A-Z0-9-]{3,31})/gi),
    ...output.matchAll(/(?:one-time|one time)\s+code[^\n]*\n\s*([A-Z0-9][A-Z0-9-]{3,31})/gi),
  ]
  return matches
    .map((item) => item[1].toUpperCase())
    .filter((item) => !["AUTHORIZATION", "CODE", "DEVICE", "NONE", "SIGNIN", "TRUE"].includes(item))
    .filter((item, index, values) => values.indexOf(item) === index)
    .slice(0, 3)
}

function setupNeedsInput(action: SshSetupAction, output: string) {
  if (action === "install") return /administrator password|sudo password/i.test(output)
  return /(?:paste|enter|type|select|choose|password|passphrase|api[\s-]?key|token|secret|press\s+[a-z])/i.test(
    cleanSetupOutput(output),
  )
}

function setupInputType(action: SshSetupAction, output: string) {
  if (action === "install") return "password"
  return /password|passphrase|api[\s-]?key|token|secret/i.test(output) ? "password" : "text"
}

export function SshConnect(props: Props) {
  const [target, setTarget] = createSignal(props.initial?.target ?? "")
  const [started, setStarted] = createSignal(false)
  const [step, setStep] = createSignal<Step>("auth")
  const [auth, setAuth] = createSignal<Auth>("password")
  const [password, setPassword] = createSignal("")
  const [privateKey, setPrivateKey] = createSignal("")
  const [privateKeyLabel, setPrivateKeyLabel] = createSignal("")
  const [passphrase, setPassphrase] = createSignal("")
  const [directory, setDirectory] = createSignal(props.initial?.directory ?? "")
  const [homePath, setHomePath] = createSignal("/")
  const [agent, setAgent] = createSignal<SshAgent>(props.initial?.agent ?? "opencode-cli")
  const [listing, setListing] = createSignal<SshFolderListing>()
  const [browsePath, setBrowsePath] = createSignal("/")
  const [browseOpen, setBrowseOpen] = createSignal(true)
  const [query, setQuery] = createSignal("")
  const [showHidden, setShowHidden] = createSignal(false)
  const [recentFolders, setRecentFolders] = createSignal(props.initial?.recentFolders ?? [])
  const [recentTargets, setRecentTargets] = createSignal(props.initial?.recentTargets ?? [])
  const [addingComputer, setAddingComputer] = createSignal((props.initial?.recentTargets ?? []).length === 0)
  const [pendingKey, setPendingKey] = createSignal<{ profile: string; fingerprint: string; type: string }>()
  const [connected, setConnected] = createSignal(false)
  const [connectedProfile, setConnectedProfile] = createSignal<string>()
  const [connectedDirectory, setConnectedDirectory] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const [browseBusy, setBrowseBusy] = createSignal(false)
  const [error, setError] = createSignal("")
  const [preflight, setPreflight] = createSignal<string>()
  const [appServer, setAppServer] = createSignal<SshCodexAppServerStatus>()
  const [setup, setSetup] = createSignal<Setup>()
  const [upgrade, setUpgrade] = createSignal<SshUpdateCheck>()
  const [rememberUpgrade, setRememberUpgrade] = createSignal(false)
  const [setupInput, setSetupInput] = createSignal("")
  const [checkingLogin, setCheckingLogin] = createSignal(false)
  const [agentStatuses, setAgentStatuses] = createSignal<Partial<Record<SshAgent, AgentStatus>>>({})
  const credentials = createSshCredentialLoader(props.ssh)
  const updates = appStorage()()
  const connections = createSshConnectionGate(props.ssh)
  const onboarding = createSshOnboardingGeneration()
  const selectedProfile = createMemo(() => {
    const normalized = normalizeSshTarget(target())
    const parsed = normalized ? parseSshTarget(normalized) : undefined
    return normalized && parsed ? sshProfile(normalized, parsed.port ?? 22) : undefined
  })
  const workspace = createMemo(() =>
    connectedSshWorkspace({
      connected: connected(),
      connectedProfile: connectedProfile(),
      connectedDirectory: connectedDirectory(),
      target: target(),
      directory: directory(),
      agent: agent(),
    }),
  )
  const entries = createMemo(() => {
    const term = query().trim().toLowerCase()
    return (listing()?.entries ?? []).filter((entry) => !term || entry.name.toLowerCase().includes(term))
  })

  function active(request: number, profile = selectedProfile()) {
    return onboarding.matches(request) && profile === selectedProfile()
  }

  onMount(() => {
    const unsubscribe = props.ssh.subscribe((event) => void onSshEvent(event))
    onCleanup(unsubscribe)
    const releaseBack = installAndroidBack(() => {
      if (pendingKey()) {
        setPendingKey()
        setError("")
        return true
      }
      if (setup()) {
        void abandonSshSetup({
          onboarding,
          ssh: props.ssh,
          reset: () => {
            setSetup()
            setPreflight()
            setCheckingLogin(false)
            setBusy(false)
            setError("")
          },
        })
        return true
      }
      if (step() === "agent") {
        setStep("folder")
        setBrowseOpen(true)
        setError("")
        return true
      }
      if (step() === "folder") {
        void leave()
        return true
      }
      if (started()) {
        clearOnboarding()
        setStarted(false)
        return true
      }
      return false
    })
    onCleanup(releaseBack)
    if (!props.initial) return
    setStarted(false)
    void loadCredentials(props.initial.profile)
  })

  async function onSshEvent(event: SshEvent) {
    const current = setup()
    if (!current) return
    const request = onboarding.current()
    const profile = selectedProfile()
    if (event.type === "started") {
      if (event.agent !== agent() || event.operation !== current.action) return
      if (current.id && current.id !== event.id) return
      setSetup({ ...current, id: event.id })
      return
    }
    if (!current.id || current.id !== event.id) return
    if (event.type === "output") {
      if (!active(request, profile) || setup() !== current) return
      setSetup({ ...current, output: appendOutput(current.output, event.data) })
      return
    }
    if (event.type === "error") {
      if (!active(request, profile) || setup() !== current) return
      setSetup({ ...current, state: "failed", output: appendOutput(current.output, `\n${event.message}\n`) })
      setError(event.message)
      setBusy(false)
      return
    }
    if (event.type !== "completed") return
    if (event.exitCode !== 0) {
      if (current.action === "login" && checkingLogin()) {
        setCheckingLogin(false)
        const ready = await checkPreflight(false, request, profile)
        if (ready) await saveWorkspace(request, profile)
        if (active(request, profile)) setBusy(false)
        return
      }
      if (!active(request, profile) || setup() !== current) return
      setSetup({
        ...current,
        state: "failed",
        output: appendOutput(current.output, `\nExited with code ${event.exitCode}.\n`),
      })
      setError(`${agentName(agent())} ${current.action} failed with exit code ${event.exitCode}.`)
      setBusy(false)
      return
    }
    if (!active(request, profile) || setup() !== current) return
    setSetup({ ...current, state: "complete" })
    if (current.action === "install") {
      const ready = await checkPreflight(true, request, profile)
      if (ready && active(request, profile)) {
        setSetup()
        await saveWorkspace(request, profile)
        if (active(request, profile)) setBusy(false)
        return
      }
      if (active(request, profile) && setup()?.action === "login") {
        void startSetup("login", request, profile)
        return
      }
      if (active(request, profile) && setup()?.state !== "running") setBusy(false)
      return
    }
    const ready = await checkPreflight(false, request, profile)
    if (ready) await saveWorkspace(request, profile)
    if (active(request, profile)) setCheckingLogin(false)
    if (active(request, profile) && setup()?.state !== "running") setBusy(false)
  }

  async function loadCredentials(value: string) {
    await credentials.load(value, selectedProfile, (credential) => {
      setAuth(credential.auth)
      setPassword(credential.auth === "password" ? credential.password : "")
      setPrivateKey(credential.auth === "privateKey" ? credential.privateKey : "")
      setPrivateKeyLabel(credential.auth === "privateKey" ? "Saved private key" : "")
      setPassphrase(credential.auth === "privateKey" ? (credential.passphrase ?? "") : "")
      setError("")
    })
  }

  function clearOnboarding(nextAuth: Auth = "password") {
    credentials.invalidate()
    onboarding.advance()
    const next = resetSshOnboarding(nextAuth)
    setAuth(next.auth)
    setPassword(next.password)
    setPrivateKey(next.privateKey)
    setPrivateKeyLabel(next.privateKeyLabel)
    setPassphrase(next.passphrase)
    setPendingKey(next.pendingKey)
    setConnected(next.connected)
    setConnectedProfile(next.connectedProfile)
    setConnectedDirectory(next.connectedDirectory)
    setBusy(next.busy)
    setBrowseBusy(next.browseBusy)
    setStep(next.step)
    setDirectory(next.directory)
    setHomePath(next.homePath)
    setListing(next.listing)
    setBrowsePath(next.browsePath)
    setBrowseOpen(next.browseOpen)
    setQuery(next.query)
    setShowHidden(next.showHidden)
    setError(next.error)
    setPreflight(next.preflight)
    setAppServer(next.appServer)
    setSetup(next.setup)
    setUpgrade()
    setRememberUpgrade(false)
    setSetupInput(next.setupInput)
    setCheckingLogin(next.checkingLogin)
    setAgentStatuses(next.agentStatuses)
  }

  const pickPrivateKey = async () => {
    const bridge = getAndroidBridge()
    if (!bridge?.sshPickPrivateKey) {
      setError("The Android private-key picker is unavailable on this device.")
      return
    }
    const request = onboarding.current()
    const profile = selectedProfile()
    try {
      const value = await bridge.sshPickPrivateKey()
      if (!active(request, profile)) return
      if (value === null || value === undefined) {
        setError("")
        return
      }
      if (typeof value !== "string" || !value.startsWith("-----BEGIN ")) {
        setError("Choose an OpenSSH private-key file to continue.")
        return
      }
      credentials.invalidate()
      onboarding.advance()
      setPrivateKey(value)
      setPrivateKeyLabel("Private key selected")
      setError("")
    } catch (cause) {
      if (!active(request, profile)) return
      setError(cause instanceof Error ? cause.message : "Could not read the private-key file.")
    }
  }

  const start = (value = target()) => {
    const normalized = normalizeSshTarget(value)
    const parsed = normalized ? parseSshTarget(normalized) : undefined
    if (!normalized || !parsed) {
      setError("Enter an SSH target such as user@mac.example.com or user@[::1]:2222.")
      return
    }
    clearOnboarding()
    setTarget(normalized)
    setStarted(true)
    setAddingComputer(false)
    void loadCredentials(sshProfile(normalized, parsed.port ?? 22) ?? "")
  }

  const chooseComputer = (value: string) => {
    const normalized = normalizeSshTarget(value)
    const parsed = normalized ? parseSshTarget(normalized) : undefined
    if (!normalized || !parsed) return
    clearOnboarding()
    setTarget(normalized)
    setAddingComputer(false)
    setStarted(true)
    void loadCredentials(sshProfile(normalized, parsed.port ?? 22) ?? "")
  }

  const chooseAuth = (value: Auth) => {
    if (auth() === value) return
    clearOnboarding(value)
    setStarted(true)
  }

  const changeTarget = (value: string) => {
    clearOnboarding()
    setTarget(value)
  }

  const changePassword = (value: string) => {
    credentials.invalidate()
    onboarding.advance()
    setBusy(false)
    setPassword(value)
  }

  const changePassphrase = (value: string) => {
    credentials.invalidate()
    onboarding.advance()
    setBusy(false)
    setPassphrase(value)
  }

  const chooseAgent = (value: SshAgent) => {
    onboarding.advance()
    setBusy(false)
    setAgent(value)
    setSetup()
    setUpgrade()
    setRememberUpgrade(false)
    setPreflight()
    setAppServer()
    setError("")
  }

  const browse = async (path = browsePath(), hidden = showHidden()) => {
    const next = validSshPath(path)
    if (!next || browseBusy()) return
    const request = onboarding.current()
    const profile = selectedProfile()
    setBrowseBusy(true)
    setError("")
    try {
      const result = await props.ssh.list(next, hidden)
      if (!active(request, profile)) return
      setBrowsePath(result.path)
      setListing(result)
    } catch (cause) {
      if (!active(request, profile)) return
      setError(cause instanceof Error ? cause.message : "Could not browse the remote machine.")
    } finally {
      if (active(request, profile)) setBrowseBusy(false)
    }
  }

  const refreshAgentStatuses = async (folder: string, request = onboarding.current(), profile = selectedProfile()) => {
    const results = await Promise.all(
      SSH_AGENTS.map(async (value) => {
        const server =
          value === "codex-cli" ? await props.ssh.codexAppServerStatus(folder).catch(() => undefined) : undefined
        if (value === "codex-cli") return { value, result: server?.preflight, auth: server?.auth, server }
        const result = await props.ssh.execVersion(value, folder).catch(() => undefined)
        const auth = result?.ok ? await props.ssh.execAuthStatus(value, folder).catch(() => undefined) : undefined
        return { value, result, auth, server }
      }),
    )
    if (!active(request, profile) || folder !== directory()) return
    const server = results.find((item) => item.value === "codex-cli")?.server
    if (agent() === "codex-cli") setAppServer(server)
    setAgentStatuses(
      Object.fromEntries(
        results.map(({ value, result, auth, server }) => [
          value,
          server
            ? server.ready
              ? "Ready"
              : server.state === "not_installed"
                ? "Not installed"
                : "Needs setup"
            : result
              ? !result.ok
                ? result.exitCode === 127
                  ? "Not installed"
                  : "Needs setup"
                : auth?.loggedIn
                  ? "Ready"
                  : "Needs setup"
              : "Needs setup",
        ]),
      ),
    )
  }

  const connect = async (value = password()) => {
    if (busy()) return
    const normalized = normalizeSshTarget(target())
    const parsed = normalized ? parseSshTarget(normalized) : undefined
    const port = parsed?.port ?? 22
    const profile = normalized ? sshProfile(normalized, port) : undefined
    if (!normalized || !parsed || !profile) {
      setError("The SSH target is invalid.")
      return
    }
    if (auth() === "password" && !value) {
      setError("Enter the SSH password, or choose private-key authentication.")
      return
    }
    if (auth() === "privateKey" && !privateKey()) {
      setError("Paste the SSH private key, or choose password authentication.")
      return
    }
    const request = onboarding.current()
    const attempt = connections.start()
    if (auth() === "password" && value !== password()) setPassword(value)
    setBusy(true)
    setError("")
    setPreflight()
    try {
      if (!(await connections.ready(attempt)) || !active(request, profile)) return
      const result = await props.ssh.connect({
        profile,
        host: parsed.host,
        port,
        username: parsed.user,
        directory: validSshPath(directory()) ?? "/",
        auth: auth(),
        ...(auth() === "password" ? { password: value } : { privateKey: privateKey(), passphrase: passphrase() }),
        saveCredentials: true,
      })
      if (result.status === "host_key_required") {
        if (!active(request, profile)) {
          await connections.cleanup(attempt, profile)
          return
        }
        setPendingKey({ profile, fingerprint: result.fingerprint, type: result.type })
        setError("Verify the SSH host-key fingerprint below before trusting this host.")
        return
      }
      if (!active(request, profile)) {
        await connections.cleanup(attempt, profile)
        return
      }
      setPendingKey()
      setConnected(true)
      setConnectedProfile(result.profile)
      setStep("folder")
      setBrowseOpen(true)
      setQuery("")
      setShowHidden(false)
      const home = await props.ssh.home()
      if (!active(request, profile)) {
        await connections.cleanup(attempt, profile)
        return
      }
      setHomePath(home)
      setDirectory(home)
      setConnectedDirectory(home)
      await browse(home, false)
    } catch (cause) {
      if (active(request, profile)) setError(cause instanceof Error ? cause.message : "SSH connection failed.")
    } finally {
      if (active(request, profile)) setBusy(false)
    }
  }

  const cancelConnect = async () => {
    if (!busy() || connected()) return
    onboarding.advance()
    setBusy(false)
    setPendingKey()
    setError("SSH connection cancelled.")
    await props.ssh.cancelConnect().catch(() => undefined)
  }

  const trust = async () => {
    const pending = pendingKey()
    if (!pending || pending.profile !== selectedProfile() || busy()) return
    const request = onboarding.current()
    const profile = selectedProfile()
    setBusy(true)
    setError("")
    try {
      await props.ssh.trustHostKey(pending.profile, pending.fingerprint)
      if (!active(request, profile) || pendingKey() !== pending) return
      setPendingKey()
      setBusy(false)
      await connect()
    } catch (cause) {
      if (active(request, profile)) setError(cause instanceof Error ? cause.message : "Host-key confirmation failed.")
    } finally {
      if (active(request, profile)) setBusy(false)
    }
  }

  const selectFolder = async (path: string) => {
    const next = validSshPath(path)
    if (!next || browseBusy()) return
    const request = onboarding.current()
    const profile = selectedProfile()
    setBrowseBusy(true)
    setError("")
    try {
      const canonical = await props.ssh.selectWorkspace(next)
      if (!active(request, profile)) return
      setDirectory(canonical)
      setConnectedDirectory(canonical)
      setStep("agent")
      setBrowseOpen(false)
      setQuery("")
      await refreshAgentStatuses(canonical, request, profile)
    } catch (cause) {
      if (active(request, profile))
        setError(cause instanceof Error ? cause.message : "Could not select the remote workspace.")
    } finally {
      if (active(request, profile)) setBrowseBusy(false)
    }
  }

  const leave = () =>
    leaveSshOnboarding({
      connections,
      onboarding,
      reset: () => {
        clearOnboarding()
        setStarted(false)
      },
    })

  const checkAgentUpdate = async (folder: string, request: number, profile: string | undefined) => {
    const selected = agent()
    if (!profile || !props.ssh.checkUpdate) return true
    const previous = await readSshUpdateRecord(updates, profile, selected)
    if (!shouldCheckSshUpdate(previous)) return true
    let result: SshUpdateCheck | undefined
    try {
      result = await props.ssh.checkUpdate(selected, folder)
    } catch {
      await writeSshUpdateRecord(updates, profile, selected, {
        checkedAt: Date.now(),
        ...(previous?.preference ? { preference: previous.preference } : {}),
      }).catch(() => undefined)
      return true
    }
    await writeSshUpdateRecord(updates, profile, selected, {
      checkedAt: Date.now(),
      ...(previous?.preference ? { preference: previous.preference } : {}),
    }).catch(() => undefined)
    if (!result.ok || !result.latestVersion || !newerSshVersion(result.currentVersion, result.latestVersion)) return true
    if (previous?.preference === "skip") return true
    if (previous?.preference === "upgrade") {
      setSetup({ action: "install", reason: "upgrade", state: "available", output: "" })
      setError("")
      void startSetup("install", request, profile, "upgrade")
      return false
    }
    setUpgrade(result)
    setRememberUpgrade(false)
    setError("")
    return false
  }

  const resolveUpgrade = async (choice: SshUpdatePreference) => {
    const result = upgrade()
    const profile = selectedProfile()
    if (!result || !profile || busy()) return
    const request = onboarding.current()
    const remember = rememberUpgrade()
    setUpgrade()
    setRememberUpgrade(false)
    setBusy(true)
    if (remember) {
      await writeSshUpdateRecord(updates, profile, result.agent, {
        checkedAt: Date.now(),
        preference: choice,
      }).catch(() => undefined)
    }
    if (choice === "skip") {
      await saveWorkspace(request, profile)
      if (active(request, profile)) setBusy(false)
      return
    }
    setSetup({ action: "install", reason: "upgrade", state: "available", output: "" })
    await startSetup("install", request, profile, "upgrade")
  }

  const checkPreflight = async (offerLogin = true, request = onboarding.current(), profile = selectedProfile()) => {
    if (!active(request, profile) || !connected()) return false
    const folder = validSshPath(directory())
    const selected = agent()
    if (!folder) {
      setError("Choose a valid remote folder before continuing.")
      return false
    }
    try {
      const server = selected === "codex-cli" ? await props.ssh.codexAppServerStatus(folder) : undefined
      const result = server?.preflight ?? (await props.ssh.execVersion(selected, folder))
      if (!active(request, profile) || !connected() || directory() !== folder || agent() !== selected) return false
      setAgentStatuses((current) => ({
        ...current,
        [selected]: server
          ? server.ready
            ? "Ready"
            : server.state === "not_installed"
              ? "Not installed"
              : "Needs setup"
          : result.ok
            ? "Ready"
            : result.exitCode === 127
              ? "Not installed"
              : "Needs setup",
      }))
      if (selected === "codex-cli") setAppServer(server)
      setPreflight(
        server?.output || result.output || result.error || `${result.executable} exited with ${result.exitCode}.`,
      )
      if (result.exitCode === 127) {
        setSetup({ action: "install", reason: "missing", state: "available", output: "" })
        setError("")
        if (offerLogin) void startSetup("install", request, profile)
        return false
      }
      if (!result.ok) {
        setError(server?.error ?? server?.message ?? result.error ?? `The ${agentName(agent())} preflight failed.`)
        return false
      }
      const auth = server?.auth ?? (await props.ssh.execAuthStatus(selected, folder))
      if (!active(request, profile) || !connected() || directory() !== folder || agent() !== selected) return false
      setPreflight(
        [
          result.output,
          auth.output,
          auth.loggedIn ? "Already signed in — continuing." : "Sign-in required before starting the agent.",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      if (auth.loggedIn) {
        if (server && !server.ready) {
          setAgentStatuses((current) => ({ ...current, [selected]: "Needs setup" }))
          setError(server.error ?? server.message)
          return false
        }
        if (!(await checkAgentUpdate(folder, request, profile))) return false
        setSetup()
        setAgentStatuses((current) => ({ ...current, [selected]: "Ready" }))
        setError("")
        return true
      }
      setAgentStatuses((current) => ({ ...current, [selected]: "Needs setup" }))
      const previous = setup()
      setSetup({ action: "login", state: "available", output: previous?.action === "login" ? previous.output : "" })
      if (offerLogin) {
        setError("")
        void startSetup("login", request, profile)
      } else {
        setError(`Sign in to ${agentName(agent())} on the remote computer to continue.`)
      }
      return false
    } catch (cause) {
      if (active(request, profile)) setError(cause instanceof Error ? cause.message : "Remote CLI preflight failed.")
      return false
    }
  }

  const saveWorkspace = async (request = onboarding.current(), profile = selectedProfile()) => {
    if (!active(request, profile)) return false
    const current = workspace()
    const normalized = current?.target
    const parsed = normalized ? parseSshTarget(normalized) : undefined
    const currentProfile = normalized && parsed ? sshProfile(normalized, parsed.port ?? 22) : undefined
    const folder = current?.directory
    if (!normalized || !parsed || !currentProfile || !folder) {
      setError("Choose a valid remote folder before continuing.")
      return false
    }
    try {
      const state: SshWorkspaceState = {
        version: 1,
        target: normalized,
        profile: currentProfile,
        host: parsed.host,
        port: parsed.port ?? 22,
        username: parsed.user,
        directory: folder,
        agent: agent(),
        recentTargets: [normalized, ...recentTargets().filter((item) => item !== normalized)].slice(0, 8),
        recentFolders: [folder, ...recentFolders().filter((item) => item !== folder)].slice(0, 3),
      }
      await persistSshWorkspace(state)
      if (!active(request, profile) || workspace()?.directory !== state.directory || agent() !== state.agent)
        return false
      setRecentTargets(state.recentTargets)
      setRecentFolders(state.recentFolders)
      props.onConnected(state)
      return true
    } catch (cause) {
      if (active(request, profile))
        setError(cause instanceof Error ? cause.message : "Could not save the remote workspace.")
      return false
    }
  }

  const startSetup = async (
    action: SshSetupAction,
    request = onboarding.current(),
    profile = selectedProfile(),
    reason: Setup["reason"] = action === "install" ? "missing" : undefined,
  ) => {
    if (!connected() || setup()?.state === "running") return
    const selected = agent()
    const folder = directory()
    setBusy(true)
    setError("")
    setSetupInput("")
    setCheckingLogin(false)
    setSetup({ action, reason, state: "running", output: "" })
    try {
      const result = await props.ssh.start({ operation: action, agent: selected, directory: folder })
      if (!active(request, profile) || agent() !== selected || directory() !== folder) return
      setSetup((current) => current && { ...current, id: result.id })
    } catch (cause) {
      if (!active(request, profile) || agent() !== selected || directory() !== folder) return
      const message = cause instanceof Error ? cause.message : `Could not start ${agentName(agent())} ${action}.`
      setSetup({ action, reason, state: "failed", output: `${message}\n` })
      setError(message)
      setBusy(false)
    }
  }

  const sendSetupInput = async () => {
    const current = setup()
    const value = setupInput()
    if (!current || !setupNeedsInput(current.action, current.output) || current.state !== "running" || !value) return
    const request = onboarding.current()
    const profile = selectedProfile()
    try {
      await props.ssh.input(`${value}${current.action === "login" ? "\r" : "\n"}`)
      if (!active(request, profile) || setup() !== current) return
      setSetupInput("")
    } catch (cause) {
      if (active(request, profile) && setup() === current)
        setError(cause instanceof Error ? cause.message : "Could not send setup input.")
    }
  }

  const checkLogin = async () => {
    const current = setup()
    if (!current || current.action !== "login" || current.state !== "running" || checkingLogin()) return
    const request = onboarding.current()
    const profile = selectedProfile()
    setCheckingLogin(true)
    setBusy(true)
    try {
      await props.ssh.interrupt()
    } catch (cause) {
      if (!active(request, profile) || setup() !== current) return
      setCheckingLogin(false)
      setBusy(false)
      setError(cause instanceof Error ? cause.message : "Could not stop the login prompt.")
    }
  }

  const cancelSetup = async () => {
    const current = setup()
    if (!current || current.state !== "running") return
    const request = onboarding.current()
    const profile = selectedProfile()
    setBusy(true)
    try {
      await props.ssh.interrupt()
      if (!active(request, profile) || setup() !== current) return
      setSetup({ ...current, state: "failed", output: appendOutput(current.output, "\nCancelled.\n") })
      setError("")
    } catch (cause) {
      if (active(request, profile) && setup() === current)
        setError(cause instanceof Error ? cause.message : `Could not cancel ${current.action}.`)
    } finally {
      if (active(request, profile)) setBusy(false)
    }
  }

  const finish = async () => {
    if (busy() || !connected()) return
    const request = onboarding.current()
    const profile = selectedProfile()
    setBusy(true)
    setError("")
    const ready = await checkPreflight(true, request, profile)
    if (ready && !setup()) await saveWorkspace(request, profile)
    if (active(request, profile) && setup()?.state !== "running") setBusy(false)
  }

  return (
    <SshShell workspace={workspace()}>
      <main class="min-h-screen bg-surface-base text-text-strong flex items-start justify-center p-3 pt-20 sm:p-6 sm:pt-20">
        <form
          class="w-full max-w-3xl rounded-2xl border border-border-weak-base bg-surface-raised-base p-4 sm:p-6 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!started()) {
              const field = event.currentTarget.elements.namedItem("target")
              start(field instanceof HTMLInputElement ? field.value : target())
              return
            }
            if (!connected()) {
              const field = event.currentTarget.elements.namedItem("password")
              void connect(field instanceof HTMLInputElement ? field.value : password())
              return
            }
            if (step() === "agent") void finish()
          }}
        >
          <header class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <p class="text-12-regular text-text-weak uppercase tracking-wide">Remote workspace</p>
              <h1 class="text-20-medium">
                {!started()
                  ? "Choose a computer"
                  : !connected()
                    ? "Verify and sign in"
                    : step() === "folder"
                      ? "Choose a workspace"
                      : "Choose an agent"}
              </h1>
              <p class="text-14-regular text-text-weak">
                {!started()
                  ? "Choose where your agent should work. You can connect directly from Android."
                  : !connected()
                    ? `Confirm this is your computer, then sign in securely.`
                    : step() === "folder"
                      ? "Pick the directory the selected agent will use."
                      : `Run the agent in ${directory()}.`}
              </p>
            </div>
            <Show when={connected()}>
              <button
                type="button"
                onClick={() => void leave()}
                class="shrink-0 rounded-md border border-border-weak-base px-3 py-2 text-12-regular"
              >
                Disconnect
              </button>
            </Show>
          </header>

          <Show when={started()}>
            <nav class="grid grid-cols-3 gap-2" aria-label="Workspace setup progress">
              <For
                each={
                  [
                    { id: "auth", label: "Computer" },
                    { id: "folder", label: "Workspace" },
                    { id: "agent", label: "Agent" },
                  ] as const
                }
              >
                {(item, index) => {
                  const active = () => index() <= ({ auth: 0, folder: 1, agent: 2 }[step()] ?? 0)
                  return (
                    <div class="flex flex-col gap-2" aria-current={step() === item.id ? "step" : undefined}>
                      <div class={`h-2 rounded-full ${active() ? "bg-surface-brand-base" : "bg-surface-weak-base"}`} />
                      <span class={`text-12-regular ${step() === item.id ? "text-text-strong" : "text-text-weak"}`}>
                        {item.label}
                      </span>
                    </div>
                  )
                }}
              </For>
            </nav>
          </Show>

          <Show when={!started()}>
            <Show when={recentTargets().length > 0 && !addingComputer()}>
              <section class="flex flex-col gap-3" aria-label="Saved computers">
                <div>
                  <h2 class="text-16-medium">Your computers</h2>
                  <p class="text-12-regular text-text-weak">Choose a saved computer and its last workspace.</p>
                </div>
                <For each={recentTargets()}>
                  {(value) => {
                    const parsed = parseSshTarget(value)
                    const folder = value === props.initial?.target ? props.initial?.directory : undefined
                    return (
                      <button
                        type="button"
                        class="flex min-h-12 items-center gap-3 rounded-xl border border-border-weak-base bg-surface-base px-3 py-2 text-left"
                        onClick={() => chooseComputer(value)}
                      >
                        <span aria-hidden="true" class="text-20-medium">
                          ⌂
                        </span>
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-14-medium">{parsed?.host ?? value}</span>
                          <span class="block truncate text-12-regular text-text-weak">
                            {parsed?.user ?? "SSH user"}
                            {folder ? ` · ${folder}` : " · Workspace saved"}
                          </span>
                        </span>
                        <span class="shrink-0 rounded-full bg-surface-success-weak px-2 py-1 text-12-regular text-text-success">
                          Saved
                        </span>
                      </button>
                    )
                  }}
                </For>
                <button
                  type="button"
                  onClick={() => {
                    clearOnboarding()
                    setTarget("")
                    setAddingComputer(true)
                  }}
                  class="min-h-12 rounded-xl border border-border-brand-base px-4 py-3 text-14-medium"
                >
                  Add computer
                </button>
              </section>
            </Show>
            <Show when={recentTargets().length === 0 || addingComputer()}>
              <div class="flex items-center justify-between gap-3">
                <label class="flex min-w-0 flex-1 flex-col gap-2 text-14-medium">
                  Computer address
                  <span class="text-12-regular text-text-weak">
                    Use the simple SSH address from your computer, for example user@macbook.local.
                  </span>
                  <input
                    required
                    name="target"
                    type="text"
                    autocomplete="off"
                    placeholder="user@mac.example.com"
                    value={target()}
                    onInput={(event) => changeTarget(event.currentTarget.value)}
                    class="rounded-md border border-border-weak-base bg-surface-base px-3 py-3"
                  />
                </label>
                <Show when={recentTargets().length > 0}>
                  <button
                    type="button"
                    onClick={() => {
                      clearOnboarding()
                      setAddingComputer(false)
                    }}
                    class="self-end shrink-0 text-12-regular underline"
                  >
                    Saved computers
                  </button>
                </Show>
              </div>
              <details class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                <summary class="cursor-pointer text-12-medium">Advanced connection details</summary>
                <p class="mt-2 text-12-regular text-text-weak">
                  Port can be appended as user@host:port. SSH keys and host verification are handled in the next step.
                </p>
              </details>
            </Show>
          </Show>

          <Show when={started() && !connected()}>
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border-weak-base bg-surface-base px-3 py-3">
              <span class="text-14-regular">{target()}</span>
              <button
                type="button"
                onClick={() => {
                  clearOnboarding()
                  setStarted(false)
                }}
                class="text-12-regular underline"
              >
                Change
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2" role="tablist" aria-label="SSH authentication">
              <button
                type="button"
                class={`rounded-lg border px-3 py-3 text-14-medium ${auth() === "password" ? "border-border-brand-base bg-surface-base" : "border-border-weak-base"}`}
                aria-selected={auth() === "password"}
                onClick={() => chooseAuth("password")}
              >
                Password
              </button>
              <button
                type="button"
                class={`rounded-lg border px-3 py-3 text-14-medium ${auth() === "privateKey" ? "border-border-brand-base bg-surface-base" : "border-border-weak-base"}`}
                aria-selected={auth() === "privateKey"}
                onClick={() => chooseAuth("privateKey")}
              >
                Private key
              </button>
            </div>
            <Show when={auth() === "password"}>
              <label class="flex flex-col gap-2 text-14-medium">
                SSH password
                <input
                  required
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  value={password()}
                  onInput={(event) => changePassword(event.currentTarget.value)}
                  class="rounded-md border border-border-weak-base bg-surface-base px-3 py-3"
                />
              </label>
            </Show>
            <Show when={auth() === "privateKey"}>
              <section class="rounded-xl border border-border-weak-base bg-surface-base p-4 flex flex-col gap-3">
                <div>
                  <h2 class="text-14-medium">Choose a private-key file</h2>
                  <p class="text-12-regular text-text-weak">
                    Android reads the file locally and stores the credential only in protected device storage.
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void pickPrivateKey()}
                    class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-3 text-12-medium"
                  >
                    Choose private key
                  </button>
                  <span class="text-12-regular text-text-weak" aria-live="polite">
                    {privateKeyLabel() || "No key selected"}
                  </span>
                </div>
              </section>
              <label class="flex flex-col gap-2 text-14-medium">
                Key passphrase <span class="text-12-regular text-text-weak">Optional · kept on this device</span>
                <input
                  type="password"
                  autocomplete="current-password"
                  value={passphrase()}
                  onInput={(event) => changePassphrase(event.currentTarget.value)}
                  class="rounded-md border border-border-weak-base bg-surface-base px-3 py-3"
                />
              </label>
            </Show>
            <Show when={pendingKey()}>
              {(key) => (
                <section
                  class="rounded-xl border border-border-brand-base bg-surface-base p-4 flex flex-col gap-3"
                  role="alert"
                >
                  <div class="flex items-start gap-3">
                    <span aria-hidden="true" class="text-20-medium">
                      🛡
                    </span>
                    <div>
                      <h2 class="text-16-medium">Confirm this is your computer</h2>
                      <p class="text-12-regular text-text-weak mt-1">
                        We found a new SSH identity for {target()}. Never trust a changed identity without checking it.
                      </p>
                    </div>
                  </div>
                  <details class="rounded-lg border border-border-weak-base p-3">
                    <summary class="cursor-pointer text-12-medium">Technical details</summary>
                    <div class="mt-2 flex flex-col gap-2">
                      <span class="text-12-regular text-text-weak">{key().type}</span>
                      <code class="break-all text-12-regular">{key().fingerprint}</code>
                      <p class="text-12-regular text-text-weak">
                        Compare this fingerprint with a trusted copy on the remote machine.
                      </p>
                    </div>
                  </details>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void trust()}
                    class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-3 disabled:opacity-50"
                  >
                    Confirm computer
                  </button>
                </section>
              )}
            </Show>
          </Show>

          <Show when={connected() && step() === "folder"}>
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border-weak-base bg-surface-base px-3 py-3">
              <div class="min-w-0">
                <p class="text-12-regular text-text-weak">Connected as</p>
                <p class="truncate text-14-medium">{target()}</p>
              </div>
              <span class="shrink-0 text-12-regular text-text-weak">SFTP ready</span>
            </div>
            <Show when={recentFolders().length > 0}>
              <section class="flex flex-col gap-2" aria-label="Recently used remote folders">
                <div>
                  <h2 class="text-14-medium">Recent folders</h2>
                  <p class="text-12-regular text-text-weak">Use one of your last three workspaces.</p>
                </div>
                <For each={recentFolders()}>
                  {(folder) => (
                    <div class="flex items-center gap-3 rounded-lg border border-border-weak-base px-3 py-3">
                      <button type="button" onClick={() => void selectFolder(folder)} class="min-w-0 flex-1 text-left">
                        <span class="block truncate text-14-medium">{folder}</span>
                        <span class="block text-12-regular text-text-weak">Remote folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void selectFolder(folder)}
                        class="shrink-0 min-h-12 rounded-md bg-surface-brand-base px-3 py-2 text-12-regular text-text-on-brand-base"
                      >
                        Use
                      </button>
                    </div>
                  )}
                </For>
              </section>
            </Show>
            <button
              type="button"
              onClick={() => setBrowseOpen(!browseOpen())}
              class="flex items-center justify-between rounded-lg border border-border-weak-base px-3 py-3 text-left"
            >
              <span>
                <span class="block text-14-medium">
                  {browseOpen() ? "Browse remote folders" : "Browse all folders"}
                </span>
                <span class="block text-12-regular text-text-weak">Start from Home and navigate with breadcrumbs.</span>
              </span>
              <span aria-hidden="true">{browseOpen() ? "⌃" : "⌄"}</span>
            </button>
            <Show when={browseOpen()}>
              <section
                class="rounded-lg border border-border-weak-base bg-surface-base p-3 flex flex-col gap-3"
                aria-label="Remote folder browser"
              >
                <div class="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    aria-label="Go to parent folder"
                    disabled={!listing()?.parent || browseBusy()}
                    onClick={() => {
                      const parent = listing()?.parent
                      if (parent) void browse(parent)
                    }}
                    class="shrink-0 rounded-md border border-border-weak-base px-3 py-2 text-12-regular disabled:opacity-50"
                  >
                    ← Up
                  </button>
                  <button
                    type="button"
                    onClick={() => void browse(homePath())}
                    class="shrink-0 rounded-md border border-border-weak-base px-3 py-2 text-12-regular"
                  >
                    Home
                  </button>
                  <For each={breadcrumbs(browsePath())}>
                    {(crumb) => (
                      <button
                        type="button"
                        onClick={() => void browse(crumb.path)}
                        class="shrink-0 rounded-md px-2 py-2 text-12-regular text-text-weak hover:text-text-strong"
                      >
                        {crumb.label}
                      </button>
                    )}
                  </For>
                </div>
                <div
                  class="rounded-md border border-border-weak-base px-3 py-2 text-12-regular text-text-weak truncate"
                  aria-label="Current remote path"
                >
                  {browsePath()}
                </div>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    type="search"
                    value={query()}
                    onInput={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Filter this folder"
                    aria-label="Filter current remote folder"
                    class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-3 py-2 text-12-regular"
                  />
                  <details class="relative shrink-0">
                    <summary class="flex min-h-12 cursor-pointer items-center rounded-md border border-border-weak-base px-3 py-2 text-12-regular">
                      More
                    </summary>
                    <label class="absolute right-0 z-10 mt-2 flex min-h-12 w-48 items-center gap-2 rounded-lg border border-border-weak-base bg-surface-raised-base p-3 text-12-regular shadow-lg">
                      <input
                        type="checkbox"
                        aria-label="Show hidden files"
                        checked={showHidden()}
                        onChange={(event) => {
                          const value = event.currentTarget.checked
                          setShowHidden(value)
                          void browse(browsePath(), value)
                        }}
                      />
                      Show hidden files
                    </label>
                  </details>
                </div>
                <Show when={!listing()}>
                  <p class="px-2 py-4 text-12-regular text-text-weak">Loading remote folders…</p>
                </Show>
                <Show when={listing() && entries().length === 0}>
                  <p class="px-2 py-4 text-12-regular text-text-weak">No matching files or folders.</p>
                </Show>
                <div
                  class="flex max-h-[46vh] flex-col gap-0 overflow-y-auto"
                  role="list"
                  aria-label="Remote files and folders"
                >
                  <For each={entries()}>
                    {(entry) => (
                      <Show
                        when={entry.type === "directory"}
                        fallback={
                          <div
                            role="listitem"
                            class="flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-text-weak"
                          >
                            <span aria-hidden="true" class="w-5 text-center">
                              •
                            </span>
                            <span class="min-w-0 flex-1 truncate text-14-regular">{entry.name}</span>
                            <span class="shrink-0 text-12-regular">{entryMeta(entry)}</span>
                          </div>
                        }
                      >
                        <button
                          type="button"
                          role="listitem"
                          onClick={() => void browse(entry.path)}
                          class="flex min-h-12 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-raised-base-hover"
                        >
                          <span aria-hidden="true" class="w-5 text-center text-text-weak">
                            ▸
                          </span>
                          <span class="min-w-0 flex-1 truncate text-14-medium">{entry.name}</span>
                          <span class="shrink-0 text-12-regular text-text-weak">{entryMeta(entry)}</span>
                        </button>
                      </Show>
                    )}
                  </For>
                </div>
                <div class="sticky bottom-0 flex items-center gap-3 border-t border-border-weak-base bg-surface-base pt-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-12-regular text-text-weak">Selected folder</p>
                    <p class="truncate text-14-medium">{browsePath()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={browseBusy() || browsePath() === "/"}
                    onClick={() => void selectFolder(browsePath())}
                    class="shrink-0 rounded-md bg-surface-brand-base px-4 py-3 text-12-regular text-text-on-brand-base"
                  >
                    Use this folder
                  </button>
                </div>
              </section>
            </Show>
          </Show>

          <Show when={connected() && step() === "agent"}>
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border-weak-base bg-surface-base px-3 py-3">
              <div class="min-w-0">
                <p class="text-12-regular text-text-weak">Remote workspace</p>
                <p class="truncate text-14-medium">{directory()}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("folder")
                  setBrowseOpen(true)
                  setError("")
                }}
                class="shrink-0 text-12-regular underline"
              >
                Change
              </button>
            </div>
            <section class="flex flex-col gap-2" aria-label="Remote agent selection">
              <div>
                <h2 class="text-14-medium">Choose the backend agent</h2>
                <p class="text-12-regular text-text-weak">
                  Slopcode Android orchestrates the session; the selected CLI runs on the host.
                </p>
              </div>
              <For each={SSH_AGENTS}>
                {(value) => (
                  <button
                    type="button"
                    aria-pressed={agent() === value}
                    onClick={() => chooseAgent(value)}
                    class={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-3 text-left ${agent() === value ? "border-border-brand-base bg-surface-base" : "border-border-weak-base"}`}
                  >
                    <span
                      aria-hidden="true"
                      class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${agent() === value ? "border-border-brand-base" : "border-border-weak-base"}`}
                    >
                      {agent() === value ? "●" : ""}
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <span class="text-14-medium">{agentName(value)}</span>
                        <span
                          class={`rounded-full px-2 py-1 text-12-regular ${agentStatuses()[value] === "Ready" ? "bg-surface-success-weak text-text-success" : agentStatuses()[value] === "Not installed" ? "bg-surface-critical-weak text-text-critical" : "bg-surface-weak-base text-text-weak"}`}
                        >
                          {agentStatuses()[value] ?? (value === "opencode-cli" ? "Recommended" : "Checking")}
                        </span>
                      </span>
                      <span class="block text-12-regular text-text-weak">{agentDescription(value)}</span>
                    </span>
                  </button>
                )}
              </For>
            </section>
            <Show when={preflight()}>
              <pre class="rounded-md bg-surface-base p-3 whitespace-pre-wrap text-12-regular">{preflight()}</pre>
            </Show>
            <Show when={agent() === "codex-cli"}>
              <section
                class="rounded-lg border border-border-weak-base bg-surface-base p-4 flex flex-col gap-3"
                aria-label="Codex App Server readiness"
                aria-live="polite"
              >
                <div>
                  <h2 class="text-14-medium">Codex App Server</h2>
                  <p class="text-12-regular text-text-weak">
                    Starts privately through SSH when your session begins; it is never exposed to the network.
                  </p>
                </div>
                <ol class="grid grid-cols-3 gap-2" aria-label="Codex App Server checklist">
                  <li
                    class={`rounded-lg border p-3 text-12-regular ${appServer()?.preflight.ok ? "border-border-brand-base" : "border-border-weak-base"}`}
                  >
                    <span class="block text-text-weak">1</span>
                    <span class="block mt-1">
                      {appServer()?.preflight.ok ? "Installed — complete" : "Installed — checking"}
                    </span>
                  </li>
                  <li
                    class={`rounded-lg border p-3 text-12-regular ${appServer()?.auth?.loggedIn ? "border-border-brand-base" : "border-border-weak-base"}`}
                  >
                    <span class="block text-text-weak">2</span>
                    <span class="block mt-1">
                      {appServer()?.auth?.loggedIn ? "Signed in — complete" : "Signed in — checking"}
                    </span>
                  </li>
                  <li
                    class={`rounded-lg border p-3 text-12-regular ${appServer()?.ready ? "border-border-brand-base" : "border-border-weak-base"}`}
                    aria-label={appServer()?.ready ? "App Server ready — complete" : "App Server handshake — checking"}
                  >
                    <span class="block text-text-weak">3</span>
                    <span class="block mt-1">{appServer()?.ready ? "Ready — complete" : "Handshake — checking"}</span>
                  </li>
                </ol>
                <p class={`text-12-regular ${appServer()?.ready ? "text-text-success" : "text-text-weak"}`}>
                  {appServer()?.message ?? "Checking Codex App Server readiness…"}
                </p>
              </section>
            </Show>
            <Show when={upgrade()}>
              {(available) => (
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Agent upgrade available"
                  class="rounded-lg border border-border-brand-base bg-surface-base p-4 flex flex-col gap-3"
                >
                  <div>
                    <h2 class="text-16-medium">Upgrade {agentName(available().agent)}?</h2>
                    <p class="text-12-regular text-text-weak">
                      A newer version is available on this computer: {available().currentVersion} → {available().latestVersion}.
                      Upgrade before starting this session?
                    </p>
                  </div>
                  <label class="flex min-h-12 items-center gap-2 text-12-regular">
                    <input
                      type="checkbox"
                      checked={rememberUpgrade()}
                      onChange={(event) => setRememberUpgrade(event.currentTarget.checked)}
                    />
                    Remember my preference
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void resolveUpgrade("upgrade")}
                      class="rounded-md bg-surface-brand-base px-4 py-3 text-12-regular text-text-on-brand-base disabled:opacity-50"
                    >
                      Upgrade
                    </button>
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void resolveUpgrade("skip")}
                      class="rounded-md border border-border-weak-base px-4 py-3 text-12-regular disabled:opacity-50"
                    >
                      Skip and Continue
                    </button>
                  </div>
                </section>
              )}
            </Show>
            <Show when={setup()}>
              {(current) => (
                <section
                  class="rounded-lg border border-border-weak-base bg-surface-base p-4 flex flex-col gap-3"
                  aria-label="Agent setup"
                  aria-live="polite"
                >
                  <div>
                    <h2 class="text-14-medium">
                      {current().action === "install"
                        ? current().reason === "upgrade"
                          ? `Upgrade ${agentName(agent())}`
                          : `${agentName(agent())} is not installed`
                        : `Sign in to ${agentName(agent())}`}
                    </h2>
                    <p class="text-12-regular text-text-weak">
                      {current().action === "install"
                        ? current().reason === "upgrade"
                          ? "A newer version is available. We will upgrade the selected agent on your computer, then verify that it is ready."
                          : "We will prepare the selected agent on your computer, then verify that it is ready."
                        : "Complete sign-in on your computer. Slopcode will verify the agent before opening the session."}
                    </p>
                    <Show when={current().action === "login"}>
                      <p class="text-12-regular text-text-weak">
                        <span class="text-text-strong">
                          {sshLoginFlow(agent()) === "device-code"
                            ? "Device-code sign-in"
                            : sshLoginFlow(agent()) === "provider-method"
                              ? "Provider sign-in"
                              : "Remote browser sign-in"}
                        </span>
                        {" · "}
                        {sshLoginGuidance(agent())}
                      </p>
                    </Show>
                  </div>
                  <ol class="grid grid-cols-3 gap-2" aria-label="Agent setup progress">
                    <li
                      class={`rounded-lg border p-3 text-12-regular ${current().action === "install" && current().state === "complete" ? "border-border-brand-base" : "border-border-weak-base"}`}
                    >
                      <span class="block text-text-weak">1</span>
                      <span class="block mt-1">Installing</span>
                    </li>
                    <li
                      class={`rounded-lg border p-3 text-12-regular ${current().action === "login" && current().state === "complete" ? "border-border-brand-base" : "border-border-weak-base"}`}
                    >
                      <span class="block text-text-weak">2</span>
                      <span class="block mt-1">Signing in</span>
                    </li>
                    <li class="rounded-lg border border-border-weak-base p-3 text-12-regular">
                      <span class="block text-text-weak">3</span>
                      <span class="block mt-1">Verifying</span>
                    </li>
                  </ol>
                  <details>
                    <summary class="cursor-pointer text-12-regular text-text-weak">Technical details</summary>
                    <code class="mt-2 block rounded-md border border-border-weak-base px-3 py-2 break-all text-12-regular">
                      {sshSetupRecipe(agent(), current().action)}
                    </code>
                  </details>
                  <Show when={current().output}>
                    <pre class="max-h-52 overflow-y-auto rounded-md border border-border-weak-base p-3 whitespace-pre-wrap text-12-regular">
                      {cleanSetupOutput(current().output)}
                    </pre>
                  </Show>
                  <Show when={current().action === "login" && current().state === "running"}>
                    <Show when={setupCodes(current().output).length > 0}>
                      <div class="rounded-lg border border-border-brand-base bg-surface-raised-base p-3">
                        <p class="text-12-medium">Device code</p>
                        <p class="mt-1 text-12-regular text-text-weak">Enter this code on the sign-in page:</p>
                        <For each={setupCodes(current().output)}>
                          {(code) => <code class="mt-2 block text-20-medium tracking-widest">{code}</code>}
                        </For>
                      </div>
                    </Show>
                    <Show when={setupNeedsInput(current().action, current().output)}>
                      <div class="flex flex-col gap-2">
                        <p class="text-12-regular text-text-weak">
                          If the agent asks for a code, password, API key, or provider choice, enter it here. Sign-in input is never saved by Slopcode.
                        </p>
                        <div class="flex gap-2">
                          <input
                            type={setupInputType(current().action, current().output)}
                            autocomplete="off"
                            value={setupInput()}
                            onInput={(event) => setSetupInput(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                void sendSetupInput()
                              }
                            }}
                            placeholder="Reply to the login prompt"
                            aria-label="Login prompt input"
                            class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-3 py-2 text-12-regular"
                          />
                          <button
                            type="button"
                            onClick={() => void sendSetupInput()}
                            disabled={!setupInput() || checkingLogin()}
                            class="rounded-md border border-border-weak-base px-3 py-2 text-12-regular disabled:opacity-50"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </Show>
                    <button
                      type="button"
                      onClick={() => void checkLogin()}
                      disabled={checkingLogin()}
                      class="w-fit text-12-regular underline disabled:opacity-50"
                    >
                      {checkingLogin() ? "Checking sign-in…" : "I completed sign-in — check again"}
                    </button>
                  </Show>
                  <Show when={current().action === "install" && current().state === "running" && setupNeedsInput(current().action, current().output)}>
                    <div class="flex flex-col gap-2">
                      <p class="text-12-regular text-text-weak">This computer needs administrator access to install its package manager. This password is sent once to the remote installer and is not saved.</p>
                      <div class="flex gap-2">
                        <input
                          type={setupInputType(current().action, current().output)}
                          autocomplete="off"
                          value={setupInput()}
                          onInput={(event) => setSetupInput(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              void sendSetupInput()
                            }
                          }}
                          placeholder="Administrator password"
                          aria-label="Administrator password"
                          class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-3 py-2 text-12-regular"
                        />
                        <button
                          type="button"
                          onClick={() => void sendSetupInput()}
                          disabled={!setupInput() || checkingLogin()}
                          class="rounded-md border border-border-weak-base px-3 py-2 text-12-regular disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </Show>
                  <For each={setupUrls(current().output)}>
                    {(url) => (
                      <div class="flex flex-col gap-1">
                        <code class="break-all text-12-regular text-text-weak">{url}</code>
                        <button
                          type="button"
                          onClick={() => void getAndroidBridge()?.openLink(url)}
                          class="w-fit text-left text-12-regular underline"
                        >
                          Open sign-in link in browser
                        </button>
                      </div>
                    )}
                  </For>
                  <Show when={current().state === "running"}>
                    <button type="button" onClick={() => void cancelSetup()} class="w-fit text-12-regular underline">
                      Cancel {current().action}
                    </button>
                  </Show>
                  <Show when={current().state !== "running"}>
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void startSetup(current().action, onboarding.current(), selectedProfile(), current().reason)}
                      class="rounded-md bg-surface-brand-base px-4 py-3 text-12-regular text-text-on-brand-base disabled:opacity-50"
                    >
                      {current().state === "failed"
                        ? current().reason === "upgrade"
                          ? "Retry upgrade"
                          : `Retry ${current().action}`
                        : current().action === "install"
                          ? `Install ${agentName(agent())} on host`
                          : `Start ${agentName(agent())} sign-in`}
                    </button>
                  </Show>
                </section>
              )}
            </Show>
          </Show>

          <Show when={error()}>
            <p
              role="alert"
              class="rounded-md bg-surface-critical-base px-3 py-2 text-14-regular text-text-on-critical-base"
            >
              {error()}
            </p>
          </Show>

          <Show when={!started() || (started() && !connected()) || (connected() && step() === "agent")}>
            <div class="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy() || Boolean(upgrade())}
                class="sticky bottom-0 z-20 rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-3 disabled:opacity-50 sm:static"
              >
                {!started()
                  ? "Continue"
                  : !connected()
                    ? busy()
                      ? "Connecting…"
                      : "Connect to SSH host"
                    : busy()
                      ? "Checking CLI…"
                      : setup()
                        ? setup()!.action === "install"
                          ? "Install the agent above"
                          : "Complete sign-in above"
                        : "Run preflight and open agent"}
              </button>
              <Show when={busy() && !connected()}>
                <button
                  type="button"
                  onClick={() => void cancelConnect()}
                  class="min-h-12 rounded-md border border-border-weak-base px-4 py-3 text-12-medium"
                >
                  Cancel connection
                </button>
              </Show>
            </div>
          </Show>
        </form>
      </main>
    </SshShell>
  )
}
