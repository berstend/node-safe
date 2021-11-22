// Lifted from https://github.com/aleclarson/glob-regex/blob/master/index.js (MIT license)
"use strict"

var dotRE = /\./g
var dotPattern = "\\."

var restRE = /\*\*$/g
var restPattern = "(.+)"

var globRE = /(?:\*\*\/|\*\*|\*)/g
var globPatterns = {
  "*": "([^/]+)", // no backslashes
  "**": "(.+/)?([^/]+)", // short for "**/*"
  "**/": "(.+/)?", // one or more directories
}

function mapToPattern(str) {
  return globPatterns[str]
}

function replace(glob) {
  return glob.replace(dotRE, dotPattern).replace(restRE, restPattern).replace(globRE, mapToPattern)
}

module.exports = replace
