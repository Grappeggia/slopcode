globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./gitlab_C8dR7I4C.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
