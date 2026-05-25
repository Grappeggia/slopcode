globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./modes_DN0v6ylF.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
