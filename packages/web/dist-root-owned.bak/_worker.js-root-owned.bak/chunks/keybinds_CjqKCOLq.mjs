globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./keybinds_nJG4e0C1.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
