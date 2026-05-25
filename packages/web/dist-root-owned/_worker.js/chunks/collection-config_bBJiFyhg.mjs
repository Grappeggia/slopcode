globalThis.process ??= {}
globalThis.process.env ??= {}
let userCollections
try {
  userCollections = (await import("./content.config_CkTL5lVS.mjs")).collections
} catch {}
const collections = userCollections

export { collections }
