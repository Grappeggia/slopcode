#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const creds = process.env.SNAPCRAFT_STORE_CREDENTIALS?.trim()
const channel = (process.env.SNAPCRAFT_CHANNEL ?? "latest/stable").replace(/^stable$/, "latest/stable")
const snap = process.env.SNAPCRAFT_SNAP_NAME ?? "slopcode"

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("snap: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("snap: skip release")
    return
  }

  if (!creds) {
    console.log("snap: skip missing SNAPCRAFT_STORE_CREDENTIALS")
    return
  }

  const tool = (await $`which snapcraft`.quiet().nothrow().text()).trim()
  if (!tool) {
    throw new Error("snapcraft is required")
  }

  const version = Script.version.replace(/^v/, "")
  if (!version) {
    throw new Error("Missing release version")
  }

  const root = process.cwd()
  const bins = [
    {
      arch: "amd64",
      path: path.join(root, "dist", "slopcode-linux-x64-baseline", "bin", "slopcode"),
    },
    {
      arch: "arm64",
      path: path.join(root, "dist", "slopcode-linux-arm64", "bin", "slopcode"),
    },
  ]

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-snap-"))
  const env = {
    ...process.env,
    SNAPCRAFT_STORE_CREDENTIALS: creds,
  }

  await $`snapcraft whoami`.env(env).quiet()

  for (const item of bins) {
    if (!(await Bun.file(item.path).exists())) {
      throw new Error(`Missing snap source binary at ${item.path}`)
    }

    const dir = path.join(tmp, item.arch)
    await fs.mkdir(path.join(dir, "bin"), { recursive: true })
    await fs.mkdir(path.join(dir, "snap"), { recursive: true })
    await $`cp ${item.path} ${path.join(dir, "bin", "slopcode")}`
    await $`chmod 755 ${path.join(dir, "bin", "slopcode")}`

    await Bun.write(
      path.join(dir, "snap", "snapcraft.yaml"),
      [
        `name: ${snap}`,
        "base: core24",
        `version: \"${version}\"`,
        "summary: The open source AI slopcoding agent.",
        "description: |",
        "  SlopCode is an open source AI slopcoding agent focused on terminal workflows.",
        "grade: stable",
        "confinement: classic",
        "platforms:",
        `  ${item.arch}:`,
        "    build-on: [amd64]",
        `    build-for: [${item.arch}]`,
        "apps:",
        "  slopcode:",
        "    command: bin/slopcode",
        "parts:",
        "  slopcode:",
        "    plugin: dump",
        "    source: .",
        "    prime:",
        "      - bin/slopcode",
        "",
      ].join("\n"),
    )

    await $`snapcraft pack --destructive-mode --platform ${item.arch} --output ${dir}`.cwd(dir).env(env)
    const file = path.join(dir, `${snap}_${version}_${item.arch}.snap`)
    if (!(await Bun.file(file).exists())) {
      throw new Error(`Missing snap artifact at ${file}`)
    }

    await $`snapcraft upload --release=${channel} ${file}`.env(env)
    console.log("snap: updated", snap, item.arch, Script.version, channel)
  }
}

await run()
