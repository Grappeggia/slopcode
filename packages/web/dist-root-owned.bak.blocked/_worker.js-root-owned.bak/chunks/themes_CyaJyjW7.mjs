globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./themes_7ql4vV1f.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
