/**
 * Runs before `npm publish`: refuse republishing an existing version, then build.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))

try {
  const published = execSync(`npm view ${pkg.name}@${pkg.version} version`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  if (published === pkg.version) {
    console.error(
      `prepublish: ${pkg.name}@${pkg.version} is already on npm. Bump version in package.json, then publish.`,
    )
    process.exit(1)
  }
} catch (err) {
  const stderr = err instanceof Error && 'stderr' in err ? String(err.stderr) : ''
  if (!/E404|404 Not Found|not in this registry/i.test(stderr)) {
    console.error('prepublish: could not check npm for an existing version')
    console.error(stderr || (err instanceof Error ? err.message : err))
    process.exit(1)
  }
}

execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' })

const distIndex = path.join(root, 'dist', 'index.js')
if (!fs.existsSync(distIndex)) {
  console.error('prepublish: missing', distIndex)
  process.exit(1)
}

console.log('prepublish: built', distIndex)
