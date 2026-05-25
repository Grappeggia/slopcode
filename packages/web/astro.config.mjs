// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import cloudflare from "@astrojs/cloudflare"
import vercel from "@astrojs/vercel"
import config from "./config.mjs"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import { spawnSync } from "child_process"
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"

const onVercel = process.env.VERCEL === "1"
const base = onVercel ? "/" : "/docs"
const redirects = onVercel
  ? {
      "/docs": "/",
      "/docs/[...slug]": "/[...slug]",
    }
  : undefined

const locales = {
  root: {
    label: "English",
    lang: "en",
    dir: "ltr",
  },
  ar: {
    label: "Arabic",
    lang: "ar",
    dir: "rtl",
  },
  bs: {
    label: "Bosnian",
    lang: "bs",
    dir: "ltr",
  },
  da: {
    label: "Danish",
    lang: "da",
    dir: "ltr",
  },
  de: {
    label: "German",
    lang: "de",
    dir: "ltr",
  },
  es: {
    label: "Spanish",
    lang: "es",
    dir: "ltr",
  },
  fr: {
    label: "French",
    lang: "fr",
    dir: "ltr",
  },
  it: {
    label: "Italian",
    lang: "it",
    dir: "ltr",
  },
  ja: {
    label: "Japanese",
    lang: "ja",
    dir: "ltr",
  },
  ko: {
    label: "Korean",
    lang: "ko",
    dir: "ltr",
  },
  nb: {
    label: "Norwegian Bokmal",
    lang: "nb",
    dir: "ltr",
  },
  pl: {
    label: "Polish",
    lang: "pl",
    dir: "ltr",
  },
  "pt-br": {
    label: "Portuguese (Brazil)",
    lang: "pt-BR",
    dir: "ltr",
  },
  ru: {
    label: "Russian",
    lang: "ru",
    dir: "ltr",
  },
  th: {
    label: "Thai",
    lang: "th",
    dir: "ltr",
  },
  tr: {
    label: "Turkish",
    lang: "tr",
    dir: "ltr",
  },
  "zh-cn": {
    label: "Chinese (Simplified)",
    lang: "zh-CN",
    dir: "ltr",
  },
  "zh-tw": {
    label: "Chinese (Traditional)",
    lang: "zh-TW",
    dir: "ltr",
  },
}

const socialImage = `${config.url}/social-share.png`

/**
 * @typedef {{
 *   type?: string
 *   url?: string
 *   children?: Node[]
 * }} Node
 */

/** @param {string} url */
function link(url) {
  if (url === "/docs") return "/"
  if (url.startsWith("/docs/")) return url.slice(5)
  if (url.startsWith("/docs?") || url.startsWith("/docs#")) return `/${url.slice(6)}`
  return url
}

/**
 * @param {Node} node
 * @param {(node: Node) => void} fn
 */
function visit(node, fn) {
  fn(node)
  if (!Array.isArray(node.children)) return
  node.children.forEach((child) => visit(child, fn))
}

function rewrite() {
  /** @param {Node} tree */
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== "link" && node.type !== "definition") return
      if (typeof node.url !== "string") return
      node.url = link(node.url)
    })
  }
}

export default defineConfig({
  site: config.url,
  base,
  redirects,
  output: "server",
  adapter: onVercel
    ? vercel({})
    : cloudflare({
        imageService: "passthrough",
      }),
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
  },
  markdown: {
    remarkPlugins: onVercel ? [rewrite] : [],
    rehypePlugins: [rehypeHeadingIds, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
  },
  integrations: [
    configSchema(),
    solidJs(),
    starlight({
      title: "SlopCode Docs",
      defaultLocale: "root",
      locales: /** @type {any} */ (locales),
      favicon: "/favicon-v3.svg",
      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: "/favicon-v3.ico",
            sizes: "32x32",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            href: "/favicon-96x96-v3.png",
            sizes: "96x96",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: "/apple-touch-icon-v3.png",
            sizes: "180x180",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "manifest",
            href: "/site.webmanifest",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: socialImage,
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content: "SlopCode docs preview",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: socialImage,
          },
        },
      ],
      lastUpdated: true,
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [{ icon: "github", label: "GitHub", href: config.github }],
      editLink: {
        baseUrl: `${config.github}/edit/dev/packages/web/`,
      },
      markdown: {
        headingLinks: false,
      },
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      sidebar: [
        "",
        "changelog",
        "go",
        "platforms",
        "cli",
        "tui",
        "workflows",
        "config",
        "permissions",
        "providers",
        "tools",
        "commands",
        "agents",
        "themes",
        "troubleshooting",
      ],
    }),
  ],
})

function configSchema() {
  return {
    name: "configSchema",
    hooks: {
      "astro:build:done": async () => {
        console.log("generating config schema")
        const schema = spawnSync(
          process.env.BUN_EXECUTABLE || "bun",
          ["../slopcode/script/schema.ts", "./dist/config.json", "./dist/tui.json"],
          {
            stdio: "inherit",
          },
        )
        if (schema.error) {
          throw schema.error
        }
        if (schema.status !== 0) {
          throw new Error("failed to generate config schema")
        }

        mkdirSync("./dist/docs", { recursive: true })
        copyFileSync("./dist/config.json", "./dist/docs/config.json")
        copyFileSync("./dist/tui.json", "./dist/docs/tui.json")

        writeFileSync(
          "./dist/docs/vercel.json",
          JSON.stringify(
            {
              redirects: [
                {
                  source: "/:path*",
                  has: [{ type: "host", value: "www.slopcode.dev" }],
                  destination: "https://slopcode.dev/:path*",
                  permanent: true,
                },
                {
                  source: "/docs/:path+/",
                  destination: "/docs/:path+",
                  permanent: false,
                },
                {
                  source: "/auth",
                  destination: "https://opencode.ai/auth",
                  permanent: false,
                },
                {
                  source: "/auth/:path*",
                  destination: "https://opencode.ai/auth/:path*",
                  permanent: false,
                },
                {
                  source: "/go",
                  destination: "/docs/go",
                  permanent: false,
                },
                {
                  source: "/go/",
                  destination: "/docs/go",
                  permanent: false,
                },
              ],
              rewrites: [
                { source: "/api/share/:path*", destination: `${config.share}/api/share/:path*` },
                { source: "/share/:path*", destination: `${config.share}/share/:path*` },
                { source: "/docs", destination: "/" },
                { source: "/docs/", destination: "/" },
                { source: "/docs/:path+", destination: "/:path*" },
              ],
            },
            null,
            2,
          ),
        )
      },
    },
  }
}
