// @ts-check
"use strict"

const path = require("path")
const os = require("os")

const { debug, toggleDebug, toggleHints } = require("./utils/debug")
const pkg = require("../package.json")
const pm = require("./options/packageManager")
const parser = require("./options/parser")
const files = require("./options/files")
const transform = require("./options/transform")
const { mergeOptions } = require("./options/merge")

/** Acquire all the info we need to run a process sandboxed */
exports.parseInput = () => {
  // Let's start with the basics
  const cwd = process.cwd()
  const nodeBinary = process.env.NODE_SAFE_VANILLA_NODE_PATH || process.execPath
  const product = process.env.NODE_SAFE_PRODUCT || ""
  // The product binaries (aka npm, yarn) are global script binaries living next to node
  const productBinary = product ? path.join(path.dirname(nodeBinary), product) : ""

  // Commandline and envs we can parse early
  const rawOptions = {
    commandline: parser.commandline.parse(),
    environment: parser.environment.parse(),
  }

  // In case we're sandboxing a package manager extract a little more info
  const packageManager = pm.parse(product, rawOptions.commandline.targetOptions)
  // See if we can find the (parent) directories containing a package.json and/or node-safe config file
  const rootDirs = files.findRoots(cwd)
  if (rootDirs.configRoot) {
    // To be able to parse the config file we had to get package manager info and config file location first
    rawOptions.configfile = parser.configfile.parse(rootDirs.configRoot, { packageManager })
  }

  // Regarding the temp dir:
  // I noticed in my testing that e.g. Chrome would write to a slightly different temp folder (?)
  // we use the "parent" temp dir here for user convenience until I investigated this more
  const tempDir = process.platform === "darwin" ? "/private/var/folders" : os.tmpdir()
  const nodeSafeSourceDir = process.env.NODE_SAFE_SOURCE_DIR || path.join(__dirname, "../")
  const home = os.homedir()
  const paths = {
    cwd,
    home,
    tempDir,
    nodeSafeSourceDir,
    nodeSafeShellDir: process.env.NODE_SAFE_DIR,
    scriptFile: rawOptions.commandline.targetScriptFile,
    scriptFileDir: rawOptions.commandline.targetScriptFileDir,
    packageRoot: rootDirs.packageRoot,
    configRoot: rootDirs.configRoot,
    nodeBinary,
    productBinary,
  }

  // Transform the supplied files and folders
  const transformPathsFn = ([sourceName, options]) => {
    // Relative paths in the config file are relative to that file, everything else relative to the cwd
    const rootPath = sourceName === "configfile" ? rootDirs.configRoot : cwd
    const entries = Object.entries(options).map(([key, value]) => {
      if (!Array.isArray(value)) {
        return [key, value]
      }
      value = transform.replaceShorthandDirs(value, paths)
      value = transform.resolveSymlinks(value)
      value = transform.resolvePaths(rootPath, value)
      return [key, value]
    })
    return [sourceName, Object.fromEntries(entries)]
  }

  // All possible sources of options ordered by "importance" for when multiple sources are used (least > most important)
  const availableOptionSources = ["configfile", "environment", "commandline"]
    .map((sourceName) => [sourceName, rawOptions[sourceName]?.options || {}])
    .map(([sourceName, options]) => transformPathsFn([sourceName, options]))
    .filter(([sourceName, options]) => Object.keys(options).length > 0)
  const customOptionSources = availableOptionSources.map(([sourceName, options]) => sourceName)

  // Merge all possible options
  const options = mergeOptions(availableOptionSources.map(([sourceName, options]) => options))

  // Check if there's a target binary override
  const sandboxTargetOverride = (options["sandbox-target"] || [])[0]
  paths.targetBinary = sandboxTargetOverride || nodeBinary
  paths.targetBinaryDir = path.dirname(paths.targetBinary)

  // Toggle debug logging
  if (options["debug-sandbox"]) {
    toggleDebug(true)
  }
  if (options["disable-sandbox-hints"]) {
    toggleHints(false)
  }

  paths.scriptParentDirs = files.allParentDirs(paths.scriptFileDir || paths.cwd)

  const facts = {
    isRunningNode: !product || product === "node",
    isRunningYarn: packageManager?.name === "yarn",
    isRunningNPM: packageManager?.name === "npm",
    isRunningNPX: packageManager?.name === "npx",
    isRunningWithinPackageScript: !!process.env.npm_lifecycle_script,
    isSandboxedAlready: !!process.env.IS_SANDBOXED,
    isRunningImplicit: !!process.env.NODE_SAFE_IMPLICIT_LAUNCH,
    isUsingDefaultConfig: customOptionSources.length === 0,
    isSupportedPlatform: process.platform === "darwin",
    isAllowAll: options["allow-all"],
  }
  facts.isPackageManager = facts.isRunningYarn || facts.isRunningNPM || facts.isRunningNPX
  facts.isExplicitlyEnablingSandbox =
    facts.isRunningImplicit && (options["enable-sandbox"] || rawOptions.configfile?.success)

  debug("process.argv", { argv: process.argv })
  debug("rawOptions", rawOptions)

  const ctx = {
    version: pkg.version,
    platform: process.platform,
    options,
    customOptionSources,
    paths,
    targetOptions: rawOptions.commandline.targetOptions,
    packageManager,
    ...facts,
  }

  return ctx
}
