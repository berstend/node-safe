"use strict"

const { spawn } = require("child_process")
const { debug } = require("./utils/debug")

exports.runUnsandboxed = ({ targetBinary = "", productBinary = "" }, args = []) => {
  debug("launch process (not sandboxed):", { targetBinary, productBinary, args })
  if (!!productBinary && targetBinary !== productBinary) {
    args.unshift(productBinary) // prepend
  }
  const bin = spawn(targetBinary, [...args], {
    stdio: [process.stdin, process.stdout, process.stderr],
  })
  bin.on("close", (code) => {
    debug("process exited", `(code: ${code})`)
    process.exit(code)
  })
}
