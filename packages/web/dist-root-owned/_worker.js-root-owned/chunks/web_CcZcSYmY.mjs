globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./web_BJn8hGl7.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
