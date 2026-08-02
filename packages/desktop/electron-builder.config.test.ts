import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const legacyDesktopEntry = "resources/linux/slopcode-desktop.desktop"

const channels = [
  { channel: "dev", appId: "ai.slopcode.desktop.dev" },
  { channel: "beta", appId: "ai.slopcode.desktop.beta" },
  { channel: "prod", appId: "ai.slopcode.desktop" },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.SLOPCODE_CHANNEL
    process.env.SLOPCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.SLOPCODE_CHANNEL
    else process.env.SLOPCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
  })
}

test("keeps a hidden prod launcher for old Linux pins", async () => {
  const previous = process.env.SLOPCODE_CHANNEL
  process.env.SLOPCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?compat=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.SLOPCODE_CHANNEL
  else process.env.SLOPCODE_CHANNEL = previous

  expect(config.deb?.fpm?.[0]).toEndWith(`${legacyDesktopEntry}=/usr/share/applications/slopcode-desktop.desktop`)
  expect(config.rpm?.fpm?.[0]).toEndWith(`${legacyDesktopEntry}=/usr/share/applications/slopcode-desktop.desktop`)

  const desktop = await Bun.file(legacyDesktopEntry).text()
  expect(desktop).toContain("Exec=/opt/SlopCode/ai.slopcode.desktop %U")
  expect(desktop).toContain("Icon=ai.slopcode.desktop")
  expect(desktop).toContain("StartupWMClass=ai.slopcode.desktop")
  expect(desktop).toContain("NoDisplay=true")
})

for (const target of [
  ["x86_64-unknown-linux-gnu", "slopcode-cli"],
  ["x86_64-apple-darwin", "slopcode-cli"],
  ["x86_64-pc-windows-msvc", "slopcode-cli.exe"],
] as const) {
  test(`packages the background CLI for ${target[0]}`, async () => {
    const previous = process.env.RUST_TARGET
    process.env.RUST_TARGET = target[0]
    const module = await import(`./electron-builder.config.ts?background-cli=${target[0]}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.RUST_TARGET
    else process.env.RUST_TARGET = previous

    expect(config.files).toContain("!resources/slopcode-cli*")
    expect(config.extraResources).toContainEqual({
      from: `resources/${target[1]}`,
      to: target[1],
    })
  })
}
