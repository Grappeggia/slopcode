globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./rules_Y1a9r9Ul.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
