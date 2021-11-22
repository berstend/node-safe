// @ts-check
"use strict"

const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const { debug } = require("../utils/debug")
const glob = require("../utils/glob-regex")

const macOSDefaults = fs.readFileSync(path.resolve(__dirname, "./macos_defaults.sb"), "utf8")

// https://nodejs.org/api/modules.html#requireextensions
// Probably far from complete, meant as a start
const safeExtensions = ["js", "json", "node", ...["cjs", "mjs", "ts"]]

const basics = (ctx) => {
  let profile = `
;;; Basics

; Allow running the target and node binary
(allow process-exec file-read* (literal "${ctx.paths.targetBinary}"))
(allow process-exec file-read* (literal "${ctx.paths.nodeBinary}"))
(allow file-read* (literal "${ctx.paths.targetBinaryDir}"))

; Allow reading source files in node_modules folders
(allow file-read*
  (regex #"(.*)/node_modules/(.*)\\.(${safeExtensions.join("|")})")
)
  `
  if (ctx.paths.nodeSafeShellDir) {
    profile += `
; Allow running things from our shell integration directory (necessary for when we run ourselves in a sandbox)
(allow process-exec file-read* (subpath "${ctx.paths.nodeSafeShellDir}"))
  `
  }
  if (ctx.paths.nodeSafeSourceDir) {
    profile += `
; Allow running things from our own source directory (necessary for when we run ourselves in a sandbox)
(allow process-exec file-read* (subpath "${ctx.paths.nodeSafeSourceDir}"))
(allow process-fork) ; needed for process-exec, has no filters
  `
  }
  if (ctx.paths.scriptFile) {
    profile += `
; Allow reading the target script file
(allow file-read*
  (literal "${ctx.paths.scriptFile}")
)
  `
  }
  if (ctx.paths.scriptFileDir) {
    profile += `
; Allow reading source files in the script directory
(allow file-read*
  (regex #"^${ctx.paths.scriptFileDir}/(.*)\\.(${safeExtensions.join("|")})")
)
  `
  }
  if (ctx.paths.packageRoot) {
    profile += `
; Allow reading source files in the packageRoot directory
(allow file-read*
  (regex #"^${ctx.paths.packageRoot}/(.*)\\.(${safeExtensions.join("|")})")
)
  `
  }
  if (ctx.paths.scriptParentDirs && ctx.paths.scriptParentDirs.length) {
    profile += `
; Allow "reading" the literal folders (not contents) containing the script (node module resolution)
(allow file-read*
  ${ctx.paths.scriptParentDirs.map((d) => `(literal "${d}")`).join("\n  ")}
  (literal "${ctx.paths.cwd}")
)
    `
  }
  return profile
}

// Special additions when a package manager (e.g. npm, yarn) is called
const packageScript = (ctx) => {
  if (!ctx.isPackageManager) {
    return ""
  }
  let profile = ""

  if (ctx.isRunningNPM || ctx.isRunningNPX) {
    profile += `
; A package manager has been called: ${ctx.packageManager.name}
; Allow read/write file access to package manager configs
(allow file-read* file-write*
  ;(literal "${ctx.paths.home}/.npmrc")
  ;(regex #"^/Users/[^.]+/.npm")
  (regex #"^/Users/[^.]+/.npm/(.*)")
  (subpath "${ctx.paths.packageRoot || ctx.paths.cwd}/node_modules")
  ; NPM is really aggressive in traversing the directories and reading package.json files
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/package.json")
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/package-lock.json")
  ; Interestingly that's required for npm
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/yarn.lock")
)

(allow process-exec process-exec-interpreter file-read*
  (literal "/private/var/select/sh")
  (literal "/usr/bin/env")
  (literal "/bin/sh")
  (literal "/bin/bash")
  (literal "/usr/sbin")

  ; Allow npm internals
  (regex #"(.*)/lib/node_modules/npm/(.*)")
)
(allow process-fork) ; needed for process-exec, has no filters
  `
  }
  if (ctx.isRunningNPX) {
    profile += `
; Give npx even more permissions to execute stuff or it's essentially useless
(allow process-exec process-exec-interpreter file-read*
  (subpath "/usr/local/") ; for git
  (subpath "${ctx.paths.home}/.npm/_npx/")
)  `
  }

  if (ctx.isRunningYarn) {
    profile += `
; A package manager has been called: ${ctx.packageManager.name}
; Allow read/write file access to package manager configs
(allow file-read* file-write*
  (regex #"(.*)/.yarnrc")
  ; todo: unfortunately yarn fails without the .npmrc
  ; need to find a way to make that non-fatal (passing an arg to yarn?)
  (regex #"(.*)/.npmrc")

  ; yarn cache dirs
  (regex #"^/Users/[^.]+/.yarn")
  (regex #"^/Users/[^.]+/.yarn/(.*)")
  (regex #"^/Users/[^.]+/.config/yarn")
  (regex #"^/Users/[^.]+/.config/yarn/(.*)")
  (regex #"^/Users/[^.]+/Library/Caches/Yarn")
  (regex #"^/Users/[^.]+/Library/Caches/Yarn/(.*)")
  (regex #"^/private/var/folders/(.*)yarn")

  ; new yarn
  (regex #"(.*)/.yarnrc.yml")
  (regex #"(.*)/.yarn")
  (regex #"(.*)/.yarn/(.*)")
  (regex #"(.*)/.pnp.(.*)")

  ; Other files needed for most commands
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/package.json")
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/yarn.lock")
  (literal "${ctx.paths.packageRoot || ctx.paths.cwd}/yarn-error.log")
  (regex #"^${ctx.paths.packageRoot || ctx.paths.cwd}/(.*).md")
  (subpath "${ctx.paths.packageRoot || ctx.paths.cwd}/node_modules")
)

(allow process-exec process-exec-interpreter file-read*
  (literal "/private/var/select/sh")
  (literal "/usr/bin/env")
  (literal "/bin/sh")
  (literal "/bin/bash")
  (literal "/usr/sbin")

  ; Allow Yarn internals
  (regex #"(.*)/node_modules/yarn/bin/(.*)")
  ; yarn uses a weird temporary shell script to call node, needed for postinstall scripts
  (regex #"/private/var/folders/(.*)/yarn(.*)")
)
(allow process-fork) ; needed for process-exec, has no filters
  `
  }

  if (ctx.packageManager?.isGlobal) {
    profile += `
; Global package manager invocation
(allow file-read* file-write*
  (regex #"(.*)/lib/node_modules")
  ; todo: can be made more narrow, find a quick way to get the global npm prefix
  (regex #"(.*)/bin/(.*)")
)  `
  }
  return profile
}

const allowRead = (globs) => {
  if (!globs) {
    return ""
  }
  if (!Array.isArray(globs)) {
    return `
; allow-read: everything
(allow file-read*)
    `
  }
  return `
; allow-read, specific files and folders
(allow file-read*
  ${globsToSandboxStatement(globs).join("\n  ")}
)
  `
}

const allowWrite = (globs) => {
  if (!globs) {
    return ""
  }
  if (!Array.isArray(globs)) {
    return `
; allow-write: everything
(allow file-write*)
    `
  }
  return `
; allow-write, specific files and folders
(allow file-write*
  ${globsToSandboxStatement(globs).join("\n  ")}
)
  `
}

const allowReadWrite = (globs) => {
  if (!globs) {
    return ""
  }
  if (!Array.isArray(globs)) {
    return `
; allow-read-write: everything
(allow file-read*)
(allow file-write*)
    `
  }
  return `
; allow-read-write, specific files and folders
(allow file-read*
  ${globsToSandboxStatement(globs).join("\n  ")}
)
(allow file-write*
  ${globsToSandboxStatement(globs).join("\n  ")}
)
  `
}

const allowRun = (globs) => {
  if (!globs) {
    return ""
  }
  let defaults = `
; allow-run, enable specifc permissions often used by external processes

; Allow IPC
(allow ipc*)
(allow iokit*) ; required by chrome
(allow mach*) ; required by chrome

; Allow app sending signals
(allow signal)

; Allow reading preferences
(allow user-preference-read)

; Allow entrypoints
(allow process-exec process-exec-interpreter file-read*
  (literal "/private/var/select/sh")
  (literal "/usr/bin/env")
  (literal "/bin/sh")
  (literal "/bin/bash")
  (literal "/usr/sbin")

  ; Allow Yarn internals, makes 'yarn run' permission errors more clear
  (regex #"(.*)/node_modules/yarn/bin/(.*)")
  ; Yarn uses a weird temporary shell script to call node and itself
  (regex #"/private/var/folders/(.*)/yarn--(.*)")
)
(allow process-fork) ; needed for process-exec, has no filters

(allow file-read*
  (regex #"^/Users/[^.]+/Library/Preferences/(.*).plist")
  (regex #"^/Library/Preferences/(.*).plist")
  (literal "/Library")
  (subpath "/dev")
  (subpath "/private/var") ; critical for certs, /private/var/select/sh and the like
  (subpath "/private/etc") ; openssl.cnf and the like
)

(allow file-write*
  (subpath "/dev")
)
  `
  if (!Array.isArray(globs)) {
    return `
; allow-run: everything
(allow process-exec)

${defaults}
    `
  }
  return `
; allow-run, specific binaries
(allow process-exec file-read*
  ${globsToSandboxStatement(globs).join("\n  ")}
)

${defaults}
  `
}

const allowNet = (shouldEnable) => {
  if (!shouldEnable) {
    return ""
  }
  return `
; allow-net: enabled
(allow network*)
(allow system-socket)
(allow file-read* (literal "/private/var/run/resolv.conf"))
  `
}

const allowNetInbound = (shouldEnable) => {
  if (!shouldEnable) {
    return ""
  }
  return `
; allow-net-inbound: enabled
(allow network-bind network-inbound
  (local tcp)
  (local udp)
)
(allow system-socket)
(allow file-read* (literal "/private/var/run/resolv.conf"))
  `
}
const allowNetOutbound = (shouldEnable) => {
  if (!shouldEnable) {
    return ""
  }
  return `
; allow-net-inbound: enabled
(allow network-inbound
  (local tcp)
  (local udp)
)
(allow network-outbound)
(allow network-bind)
(allow system-socket)
  `
}

function globsToSandboxStatement(globs = []) {
  return globs.map((g) => {
    const containsGlob = g.includes("*")
    if (!containsGlob) {
      return `(literal "${g}")`
    }
    return `(regex #"${glob(g)}")`
  })
}

// Generate a full macOS sandbox profile based on the provided data
function generateProfile(ctx) {
  let profile = `
;; Generated by node-safe v${ctx.version}
`
  profile += macOSDefaults
  profile += basics(ctx)
  profile += packageScript(ctx)
  profile += allowRead(ctx.options["allow-read"])
  profile += allowWrite(ctx.options["allow-write"])
  profile += allowReadWrite(ctx.options["allow-read-write"])
  profile += allowRun(ctx.options["allow-run"])
  profile += allowNet(ctx.options["allow-net"])
  profile += allowNetInbound(ctx.options["allow-net-inbound"])
  profile += allowNetOutbound(ctx.options["allow-net-outbound"])
  if (ctx.packageManager?.entitlements?.includes("internet")) {
    profile += `; packageManager [internet]: Enable outbound requests during package manager commands`
    profile += allowNetOutbound(true)
  }

  return profile
}

// Strip all comments and newlines
function minifyProfile(profile) {
  return profile
    .replace(/;.*/gm, "")
    .replace(/\r?\n|\r/g, " ")
    .trim()
}

function runSandboxed(ctx, minifiedProfile) {
  const sandboxArgs = ["-p", minifiedProfile]
  let targetArgs = [ctx.paths.targetBinary]
  if (!!ctx.paths.productBinary && ctx.paths.targetBinary !== ctx.paths.productBinary) {
    targetArgs.push(ctx.paths.productBinary)
  }
  if (ctx.targetOptions.length) {
    targetArgs = [...targetArgs, ...ctx.targetOptions]
  }

  debug("Launching sandbox:", targetArgs.join(" "))
  process.env.IS_SANDBOXED = "true"

  const sandbox = spawn("sandbox-exec", [...sandboxArgs, ...targetArgs], {
    stdio: [process.stdin, process.stdout, process.stderr],
  })
  sandbox.on("close", (code) => {
    debug("sandboxed process exited", `(code: ${code})`)
    process.exit(code)
  })
}

exports.handle = (ctx) => {
  const profile = generateProfile(ctx)
  debug("profile:", profile)
  const minifiedProfile = minifyProfile(profile)
  debug("minified profile:", minifiedProfile)

  if (ctx.options["print-sandbox"]) {
    console.log(profile)
    process.exit(0)
  }
  runSandboxed(ctx, minifiedProfile)
}
