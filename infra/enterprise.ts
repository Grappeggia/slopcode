import { SECRET } from "./secret"
import { shareDomain } from "./stage"

const storage = new sst.cloudflare.Bucket("EnterpriseStorage")

const teams = new sst.cloudflare.x.SolidStart("Teams", {
  domain: shareDomain,
  path: "packages/enterprise",
  buildCommand: "bun run build:cloudflare",
  environment: {
    SLOPCODE_STORAGE_ADAPTER: "r2",
    SLOPCODE_STORAGE_ACCOUNT_ID: sst.cloudflare.DEFAULT_ACCOUNT_ID,
    SLOPCODE_STORAGE_ACCESS_KEY_ID: SECRET.R2AccessKey.value,
    SLOPCODE_STORAGE_SECRET_ACCESS_KEY: SECRET.R2SecretKey.value,
    SLOPCODE_STORAGE_BUCKET: storage.name,
  },
})
