import { $ } from "bun"

await $`bun ./scripts/copy-icons.ts ${process.env.SLOPCODE_CHANNEL ?? "dev"}`

await $`cd ../slopcode && bun script/build-node.ts`
