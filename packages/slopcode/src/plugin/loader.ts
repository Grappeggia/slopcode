import {
  createPluginEntry,
  isDeprecatedPlugin,
  pluginSource,
  resolvePluginTarget,
  type PluginKind,
  type PluginPackage,
  type PluginSource,
} from "./shared"
import { ConfigPlugin } from "@/config/plugin"

export namespace PluginLoader {
  export type Plan = {
    spec: string
    options: ConfigPlugin.Options | undefined
    deprecated: boolean
  }

  export type Resolved = Plan & {
    source: PluginSource
    target: string
    entry: string
    pkg?: PluginPackage
  }

  export type Missing = Plan & {
    source: PluginSource
    target: string
    pkg?: PluginPackage
    message: string
  }

  export type Loaded = Resolved & {
    mod: Record<string, unknown>
  }

  type Candidate = { origin: ConfigPlugin.Origin; plan: Plan }
  type Report = {
    start?: (candidate: Candidate, retry: boolean) => void
    missing?: (candidate: Candidate, retry: boolean, message: string, resolved: Missing) => void
    error?: (
      candidate: Candidate,
      retry: boolean,
      stage: "install" | "entry" | "load",
      error: unknown,
      resolved?: Resolved,
    ) => void
  }

  function plan(item: ConfigPlugin.Spec): Plan {
    const spec = ConfigPlugin.pluginSpecifier(item)
    return { spec, options: ConfigPlugin.pluginOptions(item), deprecated: isDeprecatedPlugin(spec) }
  }

  export async function resolve(
    plan: Plan,
    kind: PluginKind,
  ): Promise<
    | { ok: true; value: Resolved }
    | { ok: false; stage: "missing"; value: Missing }
    | { ok: false; stage: "install" | "entry"; error: unknown }
  > {
    const target = await resolvePluginTarget(plan.spec).catch((error) => error)
    if (target instanceof Error) return { ok: false, stage: "install", error: target }
    if (!target) return { ok: false, stage: "install", error: new Error(`Plugin ${plan.spec} target is empty`) }

    const base = await createPluginEntry(plan.spec, target, kind).catch((error) => error)
    if (base instanceof Error) return { ok: false, stage: "entry", error: base }
    if (!base.entry) {
      return {
        ok: false,
        stage: "missing",
        value: {
          ...plan,
          source: base.source,
          target: base.target,
          pkg: base.pkg,
          message: `Plugin ${plan.spec} does not expose a ${kind} entrypoint`,
        },
      }
    }

    return { ok: true, value: { ...plan, source: base.source, target: base.target, entry: base.entry, pkg: base.pkg } }
  }

  export async function load(row: Resolved): Promise<{ ok: true; value: Loaded } | { ok: false; error: unknown }> {
    const mod = await import(row.entry).catch((error) => error)
    if (mod instanceof Error) return { ok: false, error: mod }
    if (!mod) return { ok: false, error: new Error(`Plugin ${row.spec} module is empty`) }
    return { ok: true, value: { ...row, mod } }
  }

  async function attempt<R>(
    candidate: Candidate,
    kind: PluginKind,
    retry: boolean,
    finish: ((load: Loaded, origin: ConfigPlugin.Origin, retry: boolean) => Promise<R | undefined>) | undefined,
    missing: ((value: Missing, origin: ConfigPlugin.Origin, retry: boolean) => Promise<R | undefined>) | undefined,
    report: Report | undefined,
  ): Promise<R | undefined> {
    const plan = candidate.plan
    if (plan.deprecated) return

    report?.start?.(candidate, retry)
    const resolved = await resolve(plan, kind)
    if (resolved.ok) {
      const loaded = await load(resolved.value)
      if (loaded.ok) {
        if (!finish) return loaded.value as R
        return finish(loaded.value, candidate.origin, retry)
      }
      const err = loaded as { ok: false; error: unknown }
      report?.error?.(candidate, retry, "load", err.error, resolved.value)
      return
    }

    const fail = resolved as
      | { ok: false; stage: "missing"; value: Missing }
      | { ok: false; stage: "install" | "entry"; error: unknown }

    if (fail.stage === "missing") {
      if (missing) {
        const value = await missing(fail.value, candidate.origin, retry)
        if (value !== undefined) return value
      }
      report?.missing?.(candidate, retry, fail.value.message, fail.value)
      return
    }

    report?.error?.(candidate, retry, fail.stage, fail.error)
  }

  type Input<R> = {
    items: ConfigPlugin.Origin[]
    kind: PluginKind
    wait?: () => Promise<void>
    finish?: (load: Loaded, origin: ConfigPlugin.Origin, retry: boolean) => Promise<R | undefined>
    missing?: (value: Missing, origin: ConfigPlugin.Origin, retry: boolean) => Promise<R | undefined>
    report?: Report
  }

  export async function loadExternal<R = Loaded>(input: Input<R>): Promise<R[]> {
    const candidates = input.items.map((origin) => ({ origin, plan: plan(origin.spec) }))
    const out = await Promise.all(
      candidates.map((candidate) => attempt(candidate, input.kind, false, input.finish, input.missing, input.report)),
    )

    if (input.wait) {
      let deps: Promise<void> | undefined
      for (let i = 0; i < candidates.length; i++) {
        if (out[i] !== undefined) continue
        const candidate = candidates[i]
        if (!candidate || pluginSource(candidate.plan.spec) !== "file") continue
        deps ??= input.wait()
        await deps
        out[i] = await attempt(candidate, input.kind, true, input.finish, input.missing, input.report)
      }
    }

    return out.filter((item) => item !== undefined) as R[]
  }
}
