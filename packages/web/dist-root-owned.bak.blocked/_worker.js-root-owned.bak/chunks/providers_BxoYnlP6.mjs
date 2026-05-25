globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./providers_DYlD9law.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
