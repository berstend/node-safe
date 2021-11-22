"use strict"

// Canonical options used for cli, env and config file parsing
const optionConfig = [
  ["allow-read", { type: "BooleanOrString", list: true }],
  ["allow-write", { type: "BooleanOrString", list: true }],
  ["allow-read-write", { type: "BooleanOrString", list: true }],
  ["allow-run", { type: "BooleanOrString", list: true }],
  ["allow-net", { type: "Boolean" }],
  ["allow-net-inbound", { type: "Boolean" }],
  ["allow-net-outbound", { type: "Boolean" }],
  ["allow-all", { type: "Boolean" }],
  ["enable-sandbox", { type: "Boolean" }],
  ["allow-unsupported-platforms", { type: "Boolean" }],
  ["disable-sandbox-hints", { type: "Boolean" }],
  ["print-sandbox", { type: "Boolean" }],
  ["debug-sandbox", { type: "Boolean" }],
  ["sandbox-target", { type: "BooleanOrString" }],
  ["sandbox-help", { type: "Boolean" }],
  ["sandbox-version", { type: "Boolean" }],
].map(([name, config]) => {
  config.cliName = "--" + name
  config.envName = "NODE_SAFE_" + name.toUpperCase().replace(/-/g, "_")
  return [name, config]
})
exports.optionConfig = optionConfig
