export const docsLocale = [
  "ar",
  "bs",
  "da",
  "de",
  "es",
  "fr",
  "it",
  "ja",
  "ko",
  "nb",
  "pl",
  "pt-br",
  "ru",
  "th",
  "tr",
  "zh-cn",
  "zh-tw",
] as const

export type DocsLocale = (typeof docsLocale)[number]

export const locale = ["root", ...docsLocale] as const

export type Locale = (typeof locale)[number]

export const localeAlias = {
  ar: "ar",
  bs: "bs",
  da: "da",
  de: "de",
  en: "root",
  es: "es",
  fr: "fr",
  it: "it",
  ja: "ja",
  ko: "ko",
  nb: "nb",
  no: "nb",
  pl: "pl",
  "pt-br": "pt-br",
  pt: "pt-br",
  root: "root",
  ru: "ru",
  th: "th",
  tr: "tr",
  zh: "zh-cn",
  "zh-cn": "zh-cn",
  "zh-hans": "zh-cn",
  "zh-sg": "zh-cn",
  "zh-tw": "zh-tw",
  "zh-hant": "zh-tw",
  "zh-hk": "zh-tw",
} as const satisfies Record<string, Locale>

function parse(input: string) {
  let decoded = ""
  try {
    decoded = decodeURIComponent(input)
  } catch {
    return null
  }

  const value = decoded.trim().toLowerCase().replaceAll("_", "-")
  if (!value) return null
  return value
}

export function exactLocale(input: string) {
  const value = parse(input)
  if (!value) return null
  if (value in localeAlias) {
    return localeAlias[value as keyof typeof localeAlias]
  }

  return null
}

export function matchLocale(input: string) {
  const value = parse(input)
  if (!value) return null

  if (value in localeAlias) {
    return localeAlias[value as keyof typeof localeAlias]
  }

  const hit = Object.keys(localeAlias).find((item) => value.startsWith(`${item}-`))
  if (hit) return localeAlias[hit as keyof typeof localeAlias]

  if (value.startsWith("en")) return "root"
  return null
}
