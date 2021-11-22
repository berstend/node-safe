"use strict"

const { isUnicodeSupported, supportsColor } = require("./terminal")

const prefix = isUnicodeSupported() ? "🤠 node-safe:" : "node-safe:"
const colorSupported = !!supportsColor.stdout

const log = (prefix, ...args) => {
  if (colorSupported) {
    // Dim output, make prefix bold
    const colorPrefix = "\x1b[2;1m" + prefix + "\x1b[0m\x1b[2m"
    console.log(
      colorPrefix,
      ...args.map((x) => (typeof x === "object" ? JSON.stringify(x, null, 2) : x)),
      "\x1b[0m", // reset colors
    )
  } else {
    console.log(prefix, ...args)
  }
}

exports.debug = (...args) => {
  if (process.env.NODE_SAFE_DEBUG_SANDBOX) {
    log(prefix, ...args)
  }
}

exports.toggleDebug = (shouldEnable) => {
  process.env.NODE_SAFE_DEBUG_SANDBOX = shouldEnable ? true : ""
}

exports.hint = (...args) => {
  // colorSupported also means we're running in a TTY
  if (!process.env.NODE_SAFE_DISABLE_SANDBOX_HINTS && colorSupported) {
    log(prefix, ...args)
  }
}

exports.toggleHints = (shouldEnable) => {
  process.env.NODE_SAFE_DISABLE_SANDBOX_HINTS = shouldEnable ? "" : true
}
