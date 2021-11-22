"use strict"

const path = require("path")
const arg = require("../../utils/arg")
const { optionConfig } = require("../options")

const listToArray = (str) =>
  str
    .split(",")
    .map((e) => e.trim())
    .filter((e) => !!e)

/** Parse commandline arguments */
function parse() {
  // Transform our canonical options into a shape understood by `arg`
  const argSchema = Object.fromEntries(
    optionConfig.map(([name, config]) => {
      let cliParser = Boolean
      if (config.type === "BooleanOrString") {
        // A custom parser to support both boolean and string
        cliParser = arg.flag((value) => value)
      }
      return [config.cliName, cliParser]
    }),
  )
  // Parse arguments from `process.argv`
  const args = arg(argSchema, { permissive: true })

  const options = Object.fromEntries(
    optionConfig
      // Extract only our own well known arguments
      .map(([name, config]) => [name, config, args[config.cliName]])
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
  // Everything else is not meant for us but the target
  const targetOptions = args._

  // Determine the target script file (e.g. `node-safe target.js`)
  // Note: This is pretty simplistic and will match `yarn whoami` => `whoami`
  let targetScriptFile = (() => {
    const positional = targetOptions.filter((e) => !e.startsWith("-") && !e.includes(":"))
    if (targetOptions.includes("-e") || targetOptions.includes("--eval")) {
      return null
    }
    return positional.find((e) => e.endsWith("js")) || positional[0]
  })()
  let targetScriptFileDir = null
  if (targetScriptFile) {
    targetScriptFile = path.resolve(targetScriptFile) // make absolute
    targetScriptFileDir = path.resolve(path.dirname(targetScriptFile))
  }

  return { options, targetOptions, targetScriptFile, targetScriptFileDir }
}
exports.parse = parse
