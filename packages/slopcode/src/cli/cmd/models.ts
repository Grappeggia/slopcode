import type { Argv } from "yargs"
import { EOL } from "os"
import { Instance } from "../../project/instance"
import { Provider } from "../../provider/provider"
import { ModelsDev } from "../../provider/models"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Config } from "../../config/config"
import { Auth } from "../../auth"
import { supportsOAuthModel } from "../../plugin/codex"
import { Flag } from "../../flag/flag"

export const ModelsCommand = cmd({
  command: "models [provider]",
  describe: "list all available models",
  builder: (yargs: Argv) => {
    return yargs
      .positional("provider", {
        describe: "provider ID to filter models by",
        type: "string",
        array: false,
      })
      .option("verbose", {
        describe: "use more verbose model output (includes metadata like costs)",
        type: "boolean",
      })
      .option("refresh", {
        describe: "refresh the models cache from models.dev",
        type: "boolean",
      })
      .option("why", {
        describe: "explain why a model is or is not visible",
        type: "string",
      })
  },
  handler: async (args) => {
    const result = await ModelsDev.refresh(Boolean(args.refresh))
    if (args.refresh) {
      const message =
        result.reason === "updated"
          ? "Models cache refreshed"
          : result.reason === "custom_path"
            ? "Models cache pinned by SLOPCODE_MODELS_PATH"
            : result.reason === "disabled"
              ? "Models refresh disabled by SLOPCODE_DISABLE_MODELS_FETCH"
              : "Models cache refresh skipped"
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + message + UI.Style.TEXT_NORMAL)
    }

    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const providers = await Provider.list()

        function printModels(providerID: string, verbose?: boolean) {
          const provider = providers[providerID]
          const sortedModels = Object.entries(provider.models).sort(([a], [b]) => a.localeCompare(b))
          for (const [modelID, model] of sortedModels) {
            process.stdout.write(`${providerID}/${modelID}`)
            process.stdout.write(EOL)
            if (verbose) {
              process.stdout.write(JSON.stringify(model, null, 2))
              process.stdout.write(EOL)
            }
          }
        }

        async function explain(providerID: string, modelID: string) {
          const [catalog, cfg, auth, source] = await Promise.all([
            ModelsDev.get(),
            Config.get(),
            Auth.get(providerID),
            ModelsDev.info(),
          ])
          const rawProvider = catalog[providerID]
          const rawModel = rawProvider?.models[modelID]
          const provider = providers[providerID]
          const model = provider?.models[modelID]
          const visible = Boolean(model)
          const apiID = model?.api.id ?? rawModel?.id ?? modelID
          const reasons: string[] = []
          const enabled = cfg.enabled_providers ? new Set(cfg.enabled_providers) : undefined
          const disabled = new Set(cfg.disabled_providers ?? [])
          const providerCfg = cfg.provider?.[providerID]
          const connected = Boolean(provider)
          const authType = auth?.type ?? (provider?.key ? "api" : undefined)

          if (enabled && !enabled.has(providerID)) reasons.push("provider is excluded by enabled_providers")
          if (disabled.has(providerID)) reasons.push("provider is disabled by disabled_providers")
          if (!rawProvider) reasons.push(`provider is not present in the ${source.source} catalog`)
          if (rawProvider && !rawModel) reasons.push(`model is not present in the ${source.source} catalog`)
          if (!connected) reasons.push("provider is not currently connected")
          if (providerCfg?.blacklist?.includes(modelID)) reasons.push("model is blacklisted in config")
          if (providerCfg?.whitelist && !providerCfg.whitelist.includes(modelID)) {
            reasons.push("model is not included in the provider whitelist")
          }
          if (rawModel?.status === "deprecated") reasons.push("model is marked deprecated")
          if (rawModel?.status === "alpha" && !Flag.SLOPCODE_ENABLE_EXPERIMENTAL_MODELS) {
            reasons.push("model is marked alpha and experimental models are disabled")
          }
          if (
            providerID === "openai" &&
            auth?.type === "oauth" &&
            !supportsOAuthModel(modelID) &&
            !supportsOAuthModel(apiID)
          ) {
            reasons.push("OpenAI OAuth filters this model")
          }
          if (providerID === "openai" && auth?.type === "oauth" && supportsOAuthModel(apiID) && !rawModel) {
            reasons.push("OpenAI OAuth would allow this model, but it is missing from the catalog")
          }
          if (visible) reasons.push("model is visible")
          if (!visible && provider && rawModel && reasons.length === 0) {
            reasons.push("model is filtered during provider initialization")
          }

          UI.println(`${providerID}/${modelID}`)
          UI.println(`- visible: ${visible ? "yes" : "no"}`)
          UI.println(`- connected: ${connected ? "yes" : "no"}`)
          UI.println(`- auth: ${authType ?? "none"}`)
          UI.println(`- catalog: ${source.source}`)
          UI.println(`- models url: ${source.url}`)
          if (source.age_ms !== undefined) UI.println(`- cache age ms: ${String(source.age_ms)}`)
          if (source.fetched_at !== undefined) UI.println(`- fetched at: ${new Date(source.fetched_at).toISOString()}`)
          if (reasons.length === 0) {
            UI.println(`- reason: no blocking reason found`)
            return
          }
          for (const reason of reasons) {
            UI.println(`- reason: ${reason}`)
          }
        }

        if (args.why) {
          const direct = Provider.parseModel(args.why)
          const providerID = args.provider ?? direct.providerID
          const modelID = direct.modelID || args.why
          if (!providerID || !modelID) {
            UI.error("--why requires a provider or a provider/model string")
            return
          }
          await explain(providerID, modelID)
          return
        }

        if (args.provider) {
          const provider = providers[args.provider]
          if (!provider) {
            UI.error(`Provider not found: ${args.provider}`)
            return
          }

          printModels(args.provider, args.verbose)
          return
        }

        const providerIDs = Object.keys(providers).sort((a, b) => {
          const aIsZen = ["slopcode", "opencode", "zenmux"].includes(a)
          const bIsZen = ["slopcode", "opencode", "zenmux"].includes(b)
          if (aIsZen && !bIsZen) return -1
          if (!aIsZen && bIsZen) return 1
          return a.localeCompare(b)
        })

        for (const providerID of providerIDs) {
          printModels(providerID, args.verbose)
        }
      },
    })
  },
})
