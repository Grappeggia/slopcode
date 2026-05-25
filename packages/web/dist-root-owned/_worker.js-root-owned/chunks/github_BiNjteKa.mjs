globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./github_D9ZiY2V8.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
