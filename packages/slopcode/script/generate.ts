import path from "path"
import { fileURLToPath } from "url"
import { normalize, type Provider } from "@slopcode-ai/core/models-dev-normalize"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const modelsUrl = process.env.SLOPCODE_MODELS_URL || "https://models.dev"
const data = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await fetch(`${modelsUrl}/api.json`).then((x) => x.text())
export const modelsData = JSON.stringify(normalize(JSON.parse(data) as Record<string, Provider>))
console.log("Loaded models.dev snapshot")
