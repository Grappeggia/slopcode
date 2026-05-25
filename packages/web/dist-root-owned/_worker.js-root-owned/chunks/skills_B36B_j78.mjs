globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./skills_BeY1w9LB.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
