globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./permissions_CEO96fYT.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
