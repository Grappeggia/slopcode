globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./modes_C73a5q6k.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
