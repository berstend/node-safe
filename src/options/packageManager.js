"use strict"

// Note: These package manager groupings are probably not perfect yet

// as of yarn 1.22.17
const allYarnCommands = [
  "access",
  "add",
  "audit",
  "autoclean",
  "bin",
  "cache",
  "check",
  "config",
  "create",
  "exec",
  "generate-lock-entry",
  "generateLockEntry",
  "global",
  "help",
  "import",
  "info",
  "init",
  "install",
  "licenses",
  "link",
  "list",
  "login",
  "logout",
  "node",
  "outdated",
  "owner",
  "pack",
  "policies",
  "publish",
  "remove",
  "run",
  "tag",
  "team",
  "unlink",
  "unplug",
  "upgrade",
  "upgrade-interactive",
  "upgradeInteractive",
  "version",
  "versions",
  "why",
  "workspace",
  "workspaces",
]

// Group commands
const yarnCommandGroups = {
  install: ["install", "add", "upgrade", "upgrade-interactive", "upgradeInteractive", "init"],
  script: ["run"],
  help: ["help", "--help", "-h", "--version", "-v"],
}

// Parse yarn cli to understand the intent and give additional entitlements
const parseYarn = (targetOptions) => {
  const positionalArgs = targetOptions.filter((o) => !o.startsWith("-")) // strip all dash args
  const result = {
    name: "yarn",
    intent: "", // command, script
    command: "", // add, install, publish
    commandGroup: "", // install, publish
    script: "", // build, test, etc
    entitlements: [], // e.g. internet
    isGlobal: positionalArgs.includes("global"),
  }

  // Simply calling "yarn" will install packages
  const isYarnInstallShorthand = positionalArgs.length === 0

  // It's possible to execute scripts with `yarn build` instead of `yarn run build`
  const isKnownCommand =
    allYarnCommands.some((x) => positionalArgs.includes(x)) || isYarnInstallShorthand
  const isScript =
    !isKnownCommand || yarnCommandGroups.script.some((x) => positionalArgs.includes(x))
  const isCommand = !isScript

  const isHelp = isCommand && yarnCommandGroups.help.some((x) => targetOptions.includes(x))

  const isInstallCommand =
    !isHelp &&
    (isYarnInstallShorthand ||
      (isCommand && yarnCommandGroups.install.some((x) => positionalArgs.includes(x))))

  result.intent = isCommand ? "command" : "script"

  if (isCommand) {
    result.command = positionalArgs.join(" ")
    if (isInstallCommand) {
      result.commandGroup = "install"
    }
    if (isHelp) {
      result.commandGroup = "help"
    }
    result.entitlements.push("internet") // we can eventually only allow this for certain commands
  }
  if (isScript) {
    result.script = positionalArgs.join(" ").replace("run ", "")
  }
  return result
}

// Parse npm cli to understand the intent and give additional entitlements
const parseNPM = (targetOptions) => {
  const positionalArgs = targetOptions.filter((o) => !o.startsWith("-")) // strip all dash args
  const result = {
    name: "npm",
    intent: "", // command, script
    command: "", // install, publish
    script: "", // build, test, etc
    entitlements: [], // e.g. internet
    isGlobal: targetOptions.some((x) => ["--global", "-g"].includes(x)),
  }

  const isScript = ["run", "run-script"].some((x) => positionalArgs.includes(x))
  const isCommand = !isScript

  result.intent = isCommand ? "command" : "script"
  if (isCommand) {
    result.entitlements.push("internet") // we can eventually only allow this for certain commands
    result.command = positionalArgs.join(" ")
  }
  if (isScript) {
    result.script = positionalArgs.join(" ").replace("run-script ", "").replace("run ", "")
  }
  return result
}

// Parse npx cli to understand the intent and give additional entitlements
const parseNPX = (targetOptions) => {
  const result = {
    name: "npx",
    intent: "command", // command, script
    command: "install", // install, publish
    entitlements: ["internet"], // e.g. internet
    isGlobal: true,
  }
  return result
}

exports.parse = (product = "", targetOptions) => {
  const isPackageManager = product === "yarn" || product === "npm" || product === "npx"
  if (!isPackageManager) {
    return
  }
  if (product === "yarn") {
    return parseYarn(targetOptions)
  }
  if (product === "npm") {
    return parseNPM(targetOptions)
  }
  if (product === "npx") {
    return parseNPX(targetOptions)
  }
  return info
}
