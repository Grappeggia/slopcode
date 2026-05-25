globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./themes_CLU0SC1C.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
