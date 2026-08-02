globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./server_CDrsV3jz.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
