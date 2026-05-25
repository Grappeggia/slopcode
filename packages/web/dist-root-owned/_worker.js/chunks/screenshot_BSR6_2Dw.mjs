globalThis.process ??= {}
globalThis.process.env ??= {}
const __0__________assets_lander_screenshot_png__ = new Proxy(
  { src: "/docs/_astro/screenshot.BdITzcNa.png", width: 1824, height: 1488, format: "png" },
  {
    get(target, name, receiver) {
      if (name === "clone") {
        return structuredClone(target)
      }
      if (name === "fsPath") {
        return "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/assets/lander/screenshot.png"
      }

      return target[name]
    },
  },
)

export { __0__________assets_lander_screenshot_png__ as _ }
