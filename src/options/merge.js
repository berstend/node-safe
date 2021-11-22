"use strict"

// Merge an array of config options
// If more than one entry adds arrays we wish to merge them, instead of replacing them
function mergeOptions(arr = []) {
  const result = {}
  // Bring all options to the top level
  const unwrapped = arr
    .filter((x) => !!x)
    .flatMap(Object.entries)
    .filter((x) => !!x)
  unwrapped.forEach(([key, options]) => {
    if (`${key}` in result) {
      if (Array.isArray(result[key]) && Array.isArray(options)) {
        result[key] = Array.from(new Set([...result[key], ...options])) // merge + dedup
        return
      }
    }
    result[key] = options
  })
  return result
}
exports.mergeOptions = mergeOptions
