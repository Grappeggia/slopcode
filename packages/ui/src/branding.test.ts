import { expect, test } from "bun:test"
import path from "node:path"
import { fallback } from "../../core/src/models-dev-fallback"
import { product } from "../../util/src/product"

const root = path.join(import.meta.dir, "../../..")
const read = (file: string) => Bun.file(path.join(root, file)).text()

test("SlopCode branding keeps the S mark and wordmark", async () => {
  const mark = "M384 96H128V160H384V96Z"
  const icons = await Promise.all([
    read("packages/identity/mark.svg"),
    read("packages/ui/src/assets/favicon/favicon-v3.svg"),
    read("packages/docs/favicon-v3.svg"),
    read("packages/web/src/components/icons/custom.tsx"),
    read("packages/stats/app/src/routes/stats-shell.tsx"),
  ])
  const wordmarks = await Promise.all([
    read("packages/console/app/src/asset/logo-ornate-dark.svg"),
    read("packages/web/src/assets/logo-ornate-dark.svg"),
    read("packages/stats/app/src/asset/logo-ornate-dark.svg"),
    read("packages/docs/logo/light.svg"),
    read("packages/docs/logo/dark.svg"),
  ])

  expect(icons[0]).toContain(mark)
  expect(icons[1]).toContain(mark)
  expect(icons[2]).toContain(mark)
  expect(icons[3]).not.toContain("return <IconOpencode")
  expect(icons[4]).toContain('data-slot="slopcode-mark"')
  wordmarks.forEach((wordmark) => {
    expect(wordmark.toLowerCase()).toContain("slopcode")
    expect(wordmark.toLowerCase()).not.toContain(">opencode<")
  })
})

test("active docs and stats surfaces use SlopCode branding", async () => {
  const docs = await Bun.file(path.join(root, "packages/docs/docs.json")).json()
  const shell = await read("packages/stats/app/src/routes/stats-shell.tsx")
  const css = await read("packages/stats/app/src/routes/index.css")
  const routes = await Promise.all([
    read("packages/stats/app/src/routes/index.tsx"),
    read("packages/stats/app/src/routes/[lab]/index.tsx"),
    read("packages/stats/app/src/routes/[lab]/[model].tsx"),
  ])
  const locales = await Array.fromAsync(
    new Bun.Glob("*.ts").scan({ cwd: path.join(root, "packages/stats/app/src/i18n"), absolute: true }),
  )
  const copy = await Promise.all([
    read("packages/stats/app/src/i18n.ts"),
    ...locales.map((file) => Bun.file(file).text()),
  ])
  const astro = await read("packages/web/astro.config.mjs")
  const manifest = await read("packages/web/public/site-docs.webmanifest")

  expect(docs.favicon).toBe("/favicon-v3.svg")
  expect(docs.logo).toEqual({ light: "/logo/light.svg", dark: "/logo/dark.svg" })
  expect(JSON.stringify({ navbar: docs.navbar, footer: docs.footer })).not.toContain("mintlify.com")
  expect(astro).toContain('href: "/docs/favicon-v3.ico"')
  expect(astro).toContain('href: "/docs/site-docs.webmanifest"')
  expect(manifest).toContain('"src": "/docs/web-app-manifest-192x192.png"')
  expect(manifest).toContain('"src": "/docs/web-app-manifest-512x512.png"')
  expect(shell).toContain("https://github.com/teamslop/slopcode")
  expect(shell).toContain("https://slopcode.dev/")
  expect(shell.toLowerCase()).not.toContain("opencode.ai")
  expect(shell).not.toContain('fallbackStars: "150K"')
  expect(css).toContain('[data-slot="slopcode-mark"]')
  expect(css).not.toContain('[data-slot="opencode-mark"]')
  routes.forEach((route) => expect(route).not.toContain("OpenCode"))
  copy.forEach((dictionary) => expect(dictionary).not.toContain("OpenCode"))
})

test("fork identity stays canonical across runtime packages", async () => {
  const [share, installation, app, provider] = await Promise.all([
    read("packages/slopcode/src/share/share-next.ts"),
    read("packages/slopcode/src/installation/index.ts"),
    read("packages/tui/src/app.tsx"),
    read("packages/core/src/plugin/provider/slopcode.ts"),
  ])
  const models = fallback.openai.models as Record<
    string,
    { reasoning_options: Array<{ type: string; values: string[] }> }
  >

  expect(product.urls.site).toBe("https://slopcode.dev")
  expect(product.urls.api).toBe("https://api.slopcode.dev")
  expect(product.urls.github).toBe("https://github.com/teamslop/slopcode")
  expect(product.share).toEqual({
    default_url: "https://slopcode.dev",
    dev_url: "https://dev.slopcode.dev",
  })
  expect(product.github).toMatchObject({
    owner: "teamslop",
    repo: "slopcode",
    full_repo: "teamslop/slopcode",
  })

  expect(share).toContain('?? "https://slopcode.dev"')
  expect(installation).toContain("https://api.github.com/repos/teamslop/slopcode/releases/latest")

  expect(app).toContain('import { DialogStatus } from "./component/dialog-status"')
  expect(app).toContain('name: "slopcode.status"')
  expect(app).toContain('slashName: "status"')
  expect(app).toContain("dialog.replace(() => <DialogStatus />)")

  expect(Object.keys(models).sort()).toEqual(["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"])
  expect(models["gpt-5.6"].reasoning_options).toEqual([
    { type: "effort", values: ["none", "low", "medium", "high", "xhigh", "max"] },
  ])
  expect(provider).toContain('const DEFAULT_MODEL = ModelV2.ID.make("gpt-5.6-sol-fast")')
})

test("new-session wordmark uses the SlopCode glyphs", async () => {
  const wordmark = await read("packages/ui/src/v2/components/wordmark-v2.tsx")

  expect(wordmark).toContain('role="img"')
  expect(wordmark).toContain('aria-label="SlopCode"')
  expect(wordmark).toContain(
    'd="M73.8462 18.4297H0V73.7154H55.3846V92.144H0V110.573H73.8462V55.2868H18.4615V36.8583H73.8462V18.4297Z"',
  )
  expect(wordmark).toContain('d="M110.774 92.144H166.159V110.573H92.3125V18.4297H110.774V92.144Z"')
  expect(wordmark).not.toContain(
    'd="M258.463 73.7154H203.079V92.144H258.463V110.573H184.617V18.4297H258.463V73.7154ZM203.079 55.2868H240.002V36.8583H203.079V55.2868Z"',
  )
  expect(wordmark).not.toContain(
    'd="M332.306 36.8583H295.383V110.573H276.922V18.4297H332.306V36.8583ZM350.768 110.573H332.306V36.8583H350.768V110.573Z"',
  )
})
