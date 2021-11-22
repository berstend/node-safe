"use strict"

const path = require("path")
const fs = require("fs")

function checkFileExistsSync(filepath) {
  try {
    fs.accessSync(filepath, fs.constants.F_OK)
    return true
  } catch (e) {
    return false
  }
}

// Get an array of all parent directories
const allParentDirs = (startingPath = "") => {
  const parts = startingPath.split(path.sep)
  const dirs = parts
    .map((part, i) => parts.slice(0, i + 1).join(path.sep))
    .filter((p) => !!p)
    .reverse()
  // dirs.push("/") // add root dir
  return dirs
}
exports.allParentDirs = allParentDirs

const findParentDir = (dirs = [], filename) => {
  for (const dir of dirs) {
    if (checkFileExistsSync(path.join(dir, filename))) {
      return dir
    }
  }
}

function findRoots(startingPath) {
  const dirs = allParentDirs(startingPath)
  return {
    packageRoot: findParentDir(dirs, "package.json"),
    configRoot: findParentDir(dirs, ".node-safe.json"),
  }
}
exports.findRoots = findRoots
