globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./gitlab_Dy6bnPFm.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
