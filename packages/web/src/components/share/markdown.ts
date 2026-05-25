import { marked } from "marked"
import { codeToHtml } from "shiki"
import markedShiki from "marked-shiki"

const origin = "https://slopcode.dev"
const protocol = new Set(["http:", "https:", "mailto:", "tel:"])

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function safeHref(value?: string | null) {
  const href = value?.trim()
  if (!href) return
  if (href.startsWith("//")) return
  if (
    href.startsWith("#") ||
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../") ||
    href.startsWith("?")
  )
    return href
  if (!URL.canParse(href, origin)) return
  if (!protocol.has(new URL(href, origin).protocol)) return
  return href
}

function attr(value?: string | null) {
  if (!value) return ""
  return ` title="${escapeHtml(value)}"`
}

const markdown = marked.use(
  {
    renderer: {
      link({ href, title, text }) {
        const next = safeHref(href)
        const body = escapeHtml(text)
        if (!next) return body
        return `<a href="${escapeHtml(next)}"${attr(title)} target="_blank" rel="noopener noreferrer">${body}</a>`
      },
      image({ href, title, text }) {
        const next = safeHref(href)
        const alt = escapeHtml(text)
        if (!next) return alt
        return `<img src="${escapeHtml(next)}" alt="${alt}"${attr(title)}>`
      },
      html(token) {
        return escapeHtml(token.raw || token.text || "")
      },
    },
  },
  markedShiki({
    highlight(code, lang) {
      return codeToHtml(code, {
        lang: lang || "text",
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      })
    },
  }),
)

export async function renderMarkdown(value: string) {
  return await markdown.parse(value)
}
