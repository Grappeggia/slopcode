export const domain = (() => {
  if ($app.stage === "production") return "slopcode.dev"
  if ($app.stage === "dev") return "dev.slopcode.ai"
  return `${$app.stage}.dev.slopcode.ai`
})()

export const zoneID = "430ba34c138cfb5360826c4909f99be8"

new cloudflare.RegionalHostname("RegionalHostname", {
  hostname: domain,
  regionKey: "us",
  zoneId: zoneID,
})

export const shareDomain = `share.${domain}`
