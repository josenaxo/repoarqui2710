import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') return javascriptFiles(path)
    return entry.isFile() && ['.js', '.mjs'].some((extension) => entry.name.endsWith(extension)) ? [path] : []
  })
}

for (const file of javascriptFiles(root)) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
}
console.log(`OK: ${root}`)
