globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./github_D6h8ZO-W.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
