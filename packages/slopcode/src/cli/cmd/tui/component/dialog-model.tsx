import { createMemo, createSignal } from "solid-js"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { entries, flatMap, map, pipe, sortBy, take } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider"
import { useKeybind } from "../context/keybind"
import * as fuzzysort from "fuzzysort"
import type { Provider } from "@slopcode-ai/sdk/v2"

type ModelChoice = {
  providerID: string
  modelID: string
}

type DialogChoice = ModelChoice | { refresh: true } | string

function isModelChoice(value: DialogChoice): value is ModelChoice {
  return typeof value === "object" && value !== null && "providerID" in value
}

function isBuiltin(provider: Provider) {
  return ["slopcode", "opencode", "zenmux"].includes(provider.id)
}

function sourceLabel(provider: Provider) {
  if (provider.id === "openai") return "Direct OpenAI"
  if (isBuiltin(provider) || provider.name.includes("Zen")) return "SlopCode Zen"
  return provider.name
}

function modelDescription(provider: Provider, modelID: string, favorite = false) {
  const parts = [`${provider.id}/${modelID}`, sourceLabel(provider)]
  if (favorite) parts.push("Favorite")
  return parts.join(" · ")
}

export function useConnected() {
  const sync = useSync()
  return createMemo(() =>
    sync.data.provider.some((x) => !isBuiltin(x) || Object.values(x.models).some((y) => y.cost?.input !== 0)),
  )
}

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const toast = useToast()
  const keybind = useKeybind()
  const [query, setQuery] = createSignal("")
  const [all, setAll] = createSignal(false)

  const connected = useConnected()
  const providers = createDialogProviderOptions()

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function toOptions(items: typeof favorites, category: string) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const provider = sync.data.provider.find((x) => x.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        return [
          {
            key: item,
            value: { providerID: provider.id, modelID: model.id } satisfies ModelChoice,
            title: model.name ?? item.modelID,
            description: modelDescription(provider, model.id, true),
            search: `${provider.name} ${provider.id}/${model.id}`,
            category,
            disabled: isBuiltin(provider) && model.id.includes("-nano"),
            footer: model.cost?.input === 0 && isBuiltin(provider) ? "Free" : undefined,
            onSelect: () => {
              dialog.clear()
              local.model.set({ providerID: provider.id, modelID: model.id }, { recent: true })
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const providerOptions = pipe(
      sync.data.provider,
      sortBy(
        (provider) => !isBuiltin(provider),
        (provider) => provider.name,
      ),
      flatMap((provider) => {
        const items = pipe(
          provider.models,
          entries(),
          map(([modelID, info]) => ({ modelID, info })),
          all() ? (items) => items : (items) => items.filter((item) => item.info.status !== "deprecated"),
          (items) => items.filter((item) => (props.providerID ? item.info.providerID === props.providerID : true)),
          map(({ modelID, info }) => ({
            value: { providerID: provider.id, modelID } satisfies ModelChoice,
            title: info.name ?? modelID,
            description: modelDescription(
              provider,
              modelID,
              favorites.some((item) => item.providerID === provider.id && item.modelID === modelID),
            ),
            search: `${provider.name} ${provider.id}/${modelID} ${info.name ?? modelID}`,
            category: connected() ? provider.name : undefined,
            disabled: isBuiltin(provider) && modelID.includes("-nano"),
            footer: info.cost?.input === 0 && isBuiltin(provider) ? "Free" : undefined,
            onSelect() {
              dialog.clear()
              local.model.set({ providerID: provider.id, modelID }, { recent: true })
            },
          })),
          (items) =>
            items.filter((item) => {
              if (!showSections) return true
              if (
                favorites.some((fav) => fav.providerID === item.value.providerID && fav.modelID === item.value.modelID)
              )
                return false
              if (
                recents.some(
                  (recent) => recent.providerID === item.value.providerID && recent.modelID === item.value.modelID,
                )
              )
                return false
              return true
            }),
          sortBy(
            (item) => item.footer !== "Free",
            (item) => item.title,
          ),
        )
        return items
      }),
    )

    const popularProviders = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: "Popular providers",
          })),
          take(6),
        )
      : []

    const refreshOption = {
      title: "Refresh model catalog",
      value: { refresh: true } as const,
      description: "Fetch latest supported models and update provider lists",
      search: "refresh models catalog models.dev provider list",
      category: showSections ? "Actions" : undefined,
      onSelect: async () => {
        await sync.models.refresh(true)
        toast.show({
          message: "Model catalog refreshed",
          variant: "info",
        })
      },
    }

    if (needle) {
      const matches = [
        ...fuzzysort
          .go(needle, providerOptions, { keys: ["title", "description", "category", "search"] })
          .map((x) => x.obj),
        ...fuzzysort.go(needle, popularProviders, { keys: ["title", "category"] }).map((x) => x.obj),
        ...fuzzysort.go(needle, [refreshOption], { keys: ["title", "description", "search"] }).map((x) => x.obj),
      ]
      return matches
    }

    return [refreshOption, ...favoriteOptions, ...recentOptions, ...providerOptions, ...popularProviders]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((x) => x.id === props.providerID) : null,
  )

  const title = createMemo(() => provider()?.name ?? "Select model")

  return (
    <DialogSelect<DialogChoice>
      options={options()}
      keybind={[
        {
          keybind: keybind.all.model_provider_list?.[0],
          title: connected() ? "Connect provider" : "View all providers",
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          keybind: keybind.all.model_favorite_toggle?.[0],
          title: "Favorite",
          disabled: !connected(),
          onTrigger: (option) => {
            if (!isModelChoice(option.value)) return
            local.model.toggleFavorite(option.value)
          },
        },
        {
          keybind: keybind.all.model_show_all_toggle?.[0],
          title: all() ? "Hide deprecated models" : "Show deprecated models",
          onTrigger: () => {
            setAll((value) => !value)
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
    />
  )
}
