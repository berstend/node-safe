"use strict"

const path = require("path")
const fs = require("fs")
const glob = require("../../utils/glob-regex")
const { optionConfig } = require("../options")
const { mergeOptions } = require("../merge")

const configFileName = ".node-safe.json"

const listToArray = (str) =>
  str
    .split(",")
    .map((e) => e.trim())
    .filter((e) => !!e)

const parseOptions = (obj) => {
  return Object.fromEntries(
    optionConfig
      // Extract only our own well known arguments
      .map(([name, config]) => [name, config, obj[name]])
      // Make an array from comma separated entries
      .map(([name, config, value]) =>
        config.list && typeof value === "string" ? [name, listToArray(value)] : [name, value],
      )
      .filter(([name, value]) => value !== undefined),
  )
}

const parseEntries = (rootObj) =>
  Object.entries(rootObj)
    // Process config options for each entry
    .map(([key, config]) => {
      return [key, config, parseOptions(config)]
    })
    // Create a new entry for each comma seperated key
    .flatMap(([key, config, options]) => {
      const keys = listToArray(key).map((k) => {
        return [k, config, options]
      })
      return keys
    })

/** Parse a `.node-safe.json` config file */
function parse(configRoot, { packageManager }) {
  const filePath = path.join(configRoot, configFileName)
  const data = fs.readFileSync(filePath).toString()

  const fail = () => ({ hasFailed: true, filePath })
  const empty = () => ({ isEmpty: true, filePath, success: true })
  if (!data.trim()) {
    return empty()
  }
  let configData = null
  try {
    configData = JSON.parse(data)
  } catch (err) {
    console.warn(`Warning: ${filePath} is malformed, ignoring.`)
    console.warn(err)
    return fail()
  }
  if (!Object.keys(configData).length) {
    return empty()
  }

  const matchingOptions = []
  const matchingConfigKeys = [] // for debug purposes

  if ("node" in configData) {
    matchingOptions.push(parseOptions(configData.node))
    matchingConfigKeys.push(["node"])
  }

  // script and command names in the config file can be special (containing globs)
  const isMatchingFilterFn =
    (product, args) =>
    ([key, config, options]) => {
      if (key === "*") {
        return true
      }
      // Check if a space in the key indicates the user wants to match against the package manager name as well
      const argStr = key.includes(" ") && !!product ? `${product} ${args}` : args
      if (!key.includes("*")) {
        return key === argStr
      }
      const reMatch = new RegExp(glob(key)).exec(argStr)
      return !!reMatch
    }

  if (packageManager?.intent === "command" && "commands" in configData) {
    ;[
      // match against the command
      ...parseEntries(configData.commands)
        .filter(() => !!packageManager.command) // continue only when defined
        .filter(isMatchingFilterFn(packageManager.name, packageManager.command))
        .map((entry) => [...entry, "command"]),
      // ... and the optional commandGroup
      ...parseEntries(configData.commands)
        .filter(() => !!packageManager.commandGroup) // continue only when defined
        .filter(isMatchingFilterFn(packageManager.name, packageManager.commandGroup))
        .map((entry) => [...entry, "commandGroup"]),
    ].forEach(([key, config, options, source]) => {
      matchingConfigKeys.push([source, key])
      matchingOptions.push(options)
    })
  }

  if (packageManager?.intent === "script" && "scripts" in configData) {
    ;[
      // match against the script name
      ...parseEntries(configData.scripts)
        .filter(isMatchingFilterFn(packageManager.name, packageManager.script))
        .map((entry) => [...entry, "script"]),
    ].forEach(([key, config, options, source]) => {
      matchingConfigKeys.push([source, key])
      matchingOptions.push(options)
    })
  }

  const options = mergeOptions(matchingOptions)
  return { options, matchingConfigKeys, filePath, success: true }
}
exports.parse = parse
