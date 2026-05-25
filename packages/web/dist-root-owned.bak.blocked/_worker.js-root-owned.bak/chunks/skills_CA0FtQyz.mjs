globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./skills_Q1ne2zb7.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
