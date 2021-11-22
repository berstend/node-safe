"use strict"

const { debug, hint } = require("./utils/debug")
const { parseInput } = require("./context")
const { runUnsandboxed } = require("./run")
const macos = require("./sandbox/macos")

function main() {
  const ctx = parseInput()
  debug("context", ctx)

  if (ctx.options["sandbox-version"] || ctx.options["sandbox-help"]) {
    console.log(`🤠 node-safe v${ctx.version}`)
    console.log("\nLocation:", require.main.filename)
    console.log(`Readme: https://github.com/berstend/node-safe#readme`)
    if (ctx.isRunningImplicit) {
      console.log("\nThe shell integration works successfully.")
      console.log("Vanilla node:", ctx.paths.nodeBinary)
      console.log(
        "\nPlease note: The sandbox is disabled by default, use --enable-sandbox or a config file to enable it.",
      )
    }
    process.exit(0)
  }

  const prettyArgs = ctx.targetOptions.join(" ")
  let prettyTarget = ctx.paths.productBinary
  if (prettyTarget.startsWith(ctx.paths.home)) {
    prettyTarget = prettyTarget.replace(ctx.paths.home, "~") // shorten
  }

  if (!ctx.isSupportedPlatform) {
    if (!ctx.options["allow-unsupported-platforms"]) {
      console.error("Unfortunately node-safe only supports macOS at this time.")
      console.error("https://github.com/berstend/node-safe#limitations")
      console.error(
        "Use '--allow-unsupported-platforms' to skip sandboxing and execute node regularly.",
      )
      process.exit(1)
    }
    hint("Unsupported platform, not sandboxing:", prettyTarget)
    return runUnsandboxed(ctx.paths, ctx.targetOptions)
  }

  if (ctx.isSandboxedAlready) {
    debug(`In Sandbox already, skipping sandbox: ${prettyTarget}`, prettyArgs)
    return runUnsandboxed(ctx.paths, ctx.targetOptions)
  }
  if (ctx.isRunningImplicit && !ctx.isExplicitlyEnablingSandbox) {
    hint(`Sandbox not enabled: ${prettyTarget}`, prettyArgs)
    return runUnsandboxed(ctx.paths, ctx.targetOptions)
  }
  if (ctx.isAllowAll) {
    hint(`Sandbox disabled with "allow-all": ${prettyTarget}`, prettyArgs)
    return runUnsandboxed(ctx.paths, ctx.targetOptions)
  }

  if (ctx.isUsingDefaultConfig) {
    hint("Sandboxed with default permissions:", prettyTarget, prettyArgs)
  } else {
    const prettySources = ctx.customOptionSources.join(", ")
    hint(`Sandboxed with custom permissions (${prettySources}):`, prettyTarget, prettyArgs)
  }

  macos.handle(ctx)
}

function run() {
  try {
    main()
  } catch (err) {
    console.error(
      `
An unexpected error occured, kindly re-run this command with NODE_SAFE_DEBUG_SANDBOX=true
and report this issue here: https://github.com/berstend/node-safe/issues
`,
    )
    console.trace(err)
    process.exit(1)
  }
}

module.exports = run
