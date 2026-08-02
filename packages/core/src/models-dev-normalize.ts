export type Provider = {
  readonly id: string
  readonly name: string
  readonly env: readonly string[]
  readonly api?: string
  readonly doc?: string
  readonly models: Readonly<Record<string, unknown>>
}

const providers = [
  {
    legacy: "opencode",
    id: "slopcode",
    name: "SlopCode Zen",
    api: "https://slopcode.dev/zen/v1",
    doc: "https://slopcode.dev/docs/zen",
  },
  {
    legacy: "opencode-go",
    id: "slopcode-go",
    name: "SlopCode Go",
    api: "https://slopcode.dev/zen/go/v1",
    doc: "https://slopcode.dev/docs/zen",
  },
] as const

export function normalize<T extends Provider>(data: Readonly<Record<string, T>>): Record<string, T>
export function normalize(data: Readonly<Record<string, Provider>>) {
  return providers.reduce<Record<string, Provider>>(
    (result, item) => {
      const legacy = data[item.legacy]
      const current = data[item.id]
      if (!legacy && !current) return result
      return {
        ...result,
        [item.id]: {
          ...legacy,
          ...current,
          id: item.id,
          name: item.name,
          env: ["SLOPCODE_API_KEY"],
          api: item.api,
          doc: item.doc,
          models: {
            ...legacy?.models,
            ...current?.models,
          },
        },
      }
    },
    Object.fromEntries(Object.entries(data).filter(([id]) => !providers.some((item) => item.legacy === id))),
  )
}
