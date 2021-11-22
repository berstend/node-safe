"use strict"

const { optionConfig } = require("../options")

const listToArray = (str) =>
  str
    .split(",")
    .map((e) => e.trim())
    .filter((e) => !!e)

/** Parse environment options */
function parse() {
  const options = Object.fromEntries(
    optionConfig
      // Extract only our own well known options from env
      .map(([name, config]) => [name, config, process.env[config.envName]])
      // Revive booleans
      .map(([name, config, value]) => {
        if (config.type === "Boolean" || config.type === "BooleanOrString") {
          if (value === "true" || value === "1") {
            value = true
          }
          if (value === "false" || value === "0") {
            value = false
          }
        }
        return [name, config, value]
      })
      // Make an array from comma separated entries
      .map(([name, config, value]) =>
        config.list && typeof value === "string" ? [name, listToArray(value)] : [name, value],
      )
      .filter(([name, value]) => value !== undefined),
  )
  return { options }
}
exports.parse = parse
