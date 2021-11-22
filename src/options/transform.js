"use strict"

const path = require("path")

// /etc, /tmp, /var are symlinks and must be prefixed with /private
// we do that automtically as to make it more convenient for the end-user
const resolveSymlinks = (entries = []) =>
  entries.map((entry) => {
    const symlinked = ["/etc", "/tmp", "/var"]
    symlinked.forEach((s) => {
      if (entry.startsWith(s)) {
        entry = entry.replace(s, "/private" + `${s}`)
      }
    })
    return entry
  })
exports.resolveSymlinks = resolveSymlinks

function replaceShorthandDirs(values = [], paths) {
  const results = []
  values.forEach((str) => {
    str = str
      .replace("[cwd]", paths.cwd)
      .replace("~/", paths.home + path.sep)
      .replace("[home]", paths.home)
      .replace("[temp]", paths.tempDir)
      .replace("[script]", paths.scriptFileDir ? paths.scriptFileDir : paths.cwd)
      .replace("[project]", paths.packageRoot ? paths.packageRoot : paths.cwd)
      .replace("[config]", paths.configRoot ? paths.configRoot : paths.cwd)
    // If [bin] is used return an absolute path for each entry in $PATH
    if (str.includes("[bin]")) {
      process.env.PATH.split(":").forEach((p) => {
        results.push(str.replace("[bin]", p))
      })
    } else {
      results.push(str)
    }
  })
  return results
}
exports.replaceShorthandDirs = replaceShorthandDirs

// Make regular paths absolute
const resolvePaths = (rootPath, entries = []) =>
  entries.map((str) => {
    const magicSymbols = ["/", "*", "(", "^"]
    return magicSymbols.includes(str[0]) ? str : path.resolve(rootPath, str)
  })
exports.resolvePaths = resolvePaths
