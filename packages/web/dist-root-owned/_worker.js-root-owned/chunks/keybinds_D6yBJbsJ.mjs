globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./keybinds_En3v7G86.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
