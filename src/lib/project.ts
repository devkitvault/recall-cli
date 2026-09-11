import fs from 'fs'
import path from 'path'

const MAX_WALK = 16
const MAX_PACKAGE_JSON_BYTES = 200_000
const MAX_SCRIPTS = 40
const SECRETISH = /key|secret|token|password|credential/i

const LOCKFILES = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'bun.lock', manager: 'bun' },
    { file: 'bun.lockb', manager: 'bun' },
    { file: 'package-lock.json', manager: 'npm' },
] as const

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export type ProjectMarker =
    | 'git'
    | 'node'
    | 'python'
    | 'go'
    | 'rust'
    | 'docker'
    | 'compose'
    | 'makefile'
    | 'django'

export interface ProjectMeta {
    manager?: PackageManager
    scripts?: string[]
    has?: ProjectMarker[]
}

function exists(dir: string, name: string): boolean {
    try {
        return fs.existsSync(path.join(dir, name))
    } catch {
        return false
    }
}

function isBlockedDir(dir: string): boolean {
    const parts = dir.split(path.sep)
    return parts.includes('node_modules') || parts.includes('.git')
}

function walkUp(start: string): string[] {
    const dirs: string[] = []
    let dir = path.resolve(start)
    const root = path.parse(dir).root
    for (let i = 0; i < MAX_WALK; i++) {
        dirs.push(dir)
        if (exists(dir, '.git')) break
        if (dir === root) break
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return dirs
}

function readScriptNames(packageJsonPath: string): string[] {
    try {
        const stat = fs.statSync(packageJsonPath)
        if (!stat.isFile() || stat.size > MAX_PACKAGE_JSON_BYTES) return []
        const raw = fs.readFileSync(packageJsonPath, 'utf8')
        const json: unknown = JSON.parse(raw)
        if (!json || typeof json !== 'object' || Array.isArray(json)) return []
        const scripts = (json as { scripts?: unknown }).scripts
        if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) return []
        const names: string[] = []
        for (const key of Object.keys(scripts)) {
            if (!key || key.length > 64) continue
            names.push(SECRETISH.test(key) ? '[redacted]' : key)
            if (names.length >= MAX_SCRIPTS) break
        }
        return [...new Set(names)]
    } catch {
        return []
    }
}

function markersIn(dir: string): ProjectMarker[] {
    const found: ProjectMarker[] = []
    if (exists(dir, '.git')) found.push('git')
    if (exists(dir, 'package.json')) found.push('node')
    if (exists(dir, 'requirements.txt') || exists(dir, 'pyproject.toml')) found.push('python')
    if (exists(dir, 'manage.py')) found.push('django')
    if (exists(dir, 'go.mod')) found.push('go')
    if (exists(dir, 'Cargo.toml')) found.push('rust')
    if (exists(dir, 'Dockerfile')) found.push('docker')
    if (
        exists(dir, 'compose.yml')
        || exists(dir, 'compose.yaml')
        || exists(dir, 'docker-compose.yml')
        || exists(dir, 'docker-compose.yaml')
    ) {
        found.push('compose')
    }
    if (exists(dir, 'Makefile') || exists(dir, 'makefile')) found.push('makefile')
    return found
}

export function detectProject(cwd: string = process.cwd()): ProjectMeta | undefined {
    let start = cwd
    try {
        start = fs.realpathSync(cwd)
    } catch {
        start = path.resolve(cwd)
    }
    if (isBlockedDir(start)) return undefined

    const dirs = walkUp(start).filter((dir) => !isBlockedDir(dir))
    if (!dirs.length) return undefined

    const has = new Set<ProjectMarker>()
    for (const dir of dirs) {
        for (const marker of markersIn(dir)) has.add(marker)
    }

    const pkgDir = dirs.find((dir) => exists(dir, 'package.json'))
    const scripts = pkgDir ? readScriptNames(path.join(pkgDir, 'package.json')) : []

    let manager: PackageManager | undefined
    for (const dir of dirs) {
        const hit = LOCKFILES.find((lock) => exists(dir, lock.file))
        if (hit) {
            manager = hit.manager
            break
        }
    }
    if (!manager && scripts.length) manager = 'npm'

    if (!has.size && !scripts.length && !manager) return undefined

    const meta: ProjectMeta = {}
    if (manager) meta.manager = manager
    if (scripts.length) meta.scripts = scripts
    if (has.size) meta.has = [...has]
    return meta
}
