import { createMemo } from "solid-js"
import { usePromptRef } from "@tui/context/prompt"
import { map, pipe, sortBy } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useToast } from "../ui/toast"
import { dismissPromptSlash } from "../util/prompt-slash"

function supportsText(model: {
  modalities?: {
    input: string[]
    output: string[]
  }
}) {
  if (!model.modalities) return true
  return model.modalities.input.includes("text") && model.modalities.output.includes("text")
}

export function DialogModelCompletion(props: { providerID?: string }) {
  const sync = useSync()
  const sdk = useSDK()
  const dialog = useDialog()
  const toast = useToast()
  const promptRef = usePromptRef()

  const provider = createMemo(() => {
    if (!props.providerID) return
    return sync.data.provider_next.all.find((item) => item.id === props.providerID)
  })

  const overrides = createMemo(() => sync.data.config.autocomplete?.provider_model_overrides ?? {})

  async function persist(providerID: string, modelID: string | null | undefined) {
    const selected = sync.data.provider_next.all.find((item) => item.id === providerID)
    if (!selected) {
      toast.show({
        variant: "error",
        message: `Provider not found: ${providerID}`,
      })
      return
    }

    if (typeof modelID === "string") {
      const model = selected.models[modelID]
      if (!model) {
        toast.show({
          variant: "error",
          message: `Model not found for ${providerID}: ${modelID}`,
        })
        return
      }
      if (!supportsText(model)) {
        toast.show({
          variant: "error",
          message: `Model ${providerID}/${modelID} does not support text completion`,
        })
        return
      }
    }

    try {
      const current = await sdk.client.global.config.get({ throwOnError: true }).then((item) => item.data ?? {})
      const overrides = {
        ...(current.autocomplete?.provider_model_overrides ?? {}),
      }

      if (modelID === undefined) {
        delete overrides[providerID]
      } else {
        overrides[providerID] = modelID
      }

      await sdk.client.global.config.update(
        {
          config: {
            autocomplete: {
              provider_model_overrides: overrides,
            },
          },
        },
        { throwOnError: true },
      )

      await sdk.client.instance.dispose()
      await sync.bootstrap()

      const suffix =
        modelID === undefined ? "automatic model" : modelID === null ? "selected model" : `${providerID}/${modelID}`

      toast.show({
        variant: "success",
        message: `Autocomplete model set to ${suffix}`,
      })

      dismissPromptSlash(promptRef.current)
      dialog.clear()
    } catch {
      toast.show({
        variant: "error",
        message: "Failed to update autocomplete model override",
      })
    }
  }

  if (!provider()) {
    const options = createMemo(() =>
      pipe(
        sync.data.provider_next.all,
        sortBy((item) => item.name.toLowerCase()),
        map((item) => {
          const value = overrides()[item.id]
          const description =
            value === undefined ? "Automatic" : value === null ? "Selected model" : `Override: ${value}`

          return {
            title: item.name,
            description,
            value: item.id,
            onSelect() {
              dialog.replace(() => <DialogModelCompletion providerID={item.id} />)
            },
          }
        }),
      ),
    )

    return <DialogSelect title="Autocomplete provider" options={options()} />
  }

  const current = createMemo(() => {
    const value = overrides()[provider()!.id]
    if (value === undefined) {
      return {
        mode: "auto" as const,
      }
    }
    if (value === null) {
      return {
        mode: "selected" as const,
      }
    }
    return {
      mode: "model" as const,
      id: value,
    }
  })

  const options = createMemo(() => {
    const selected = provider()!
    const models = Object.entries(selected.models)
      .filter(([_, model]) => supportsText(model))
      .sort((a, b) => {
        const aName = a[1].name ?? a[0]
        const bName = b[1].name ?? b[0]
        const byName = aName.localeCompare(bName)
        if (byName !== 0) return byName
        return a[0].localeCompare(b[0])
      })
      .map(([modelID, model]) => ({
        title: model.name ?? modelID,
        description: modelID,
        value: {
          mode: "model" as const,
          id: modelID,
        },
      }))

    return [
      {
        title: "Automatic (recommended)",
        description: "Use built-in fast model routing",
        value: {
          mode: "auto" as const,
        },
      },
      {
        title: "Use selected model",
        description: "Disable fast remap for this provider",
        value: {
          mode: "selected" as const,
        },
      },
      ...models,
    ]
  })

  return (
    <DialogSelect
      title={`Autocomplete model: ${provider()!.name}`}
      options={options()}
      current={current()}
      onSelect={(option) => {
        if (option.value.mode === "auto") {
          persist(provider()!.id, undefined)
          return
        }
        if (option.value.mode === "selected") {
          persist(provider()!.id, null)
          return
        }
        persist(provider()!.id, option.value.id)
      }}
    />
  )
}
