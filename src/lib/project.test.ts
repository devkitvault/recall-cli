import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it } from 'node:test'
import { detectProject } from './project'

function fixture(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-project-'))
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, rel)
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, body)
    }
    return root
}

describe('detectProject', () => {
    it('reads script names from the nearest package.json and pnpm from a parent lockfile', () => {
        const root = fixture({
            '.git/HEAD': 'ref: refs/heads/main',
            'pnpm-lock.yaml': 'lockfileVersion: 9',
            'package.json': '{"scripts":{"lint":"eslint ."}}',
            'apps/web/package.json': '{"scripts":{"dev":"next dev","test":"vitest","build":"next build","release:secret":"echo no"}}',
        })
        const meta = detectProject(path.join(root, 'apps/web'))
        assert.equal(meta?.manager, 'pnpm')
        assert.deepEqual(meta?.scripts, ['dev', 'test', 'build', '[redacted]'])
        assert.ok(meta?.has?.includes('node'))
        assert.ok(meta?.has?.includes('git'))
    })

    it('never returns script bodies', () => {
        const root = fixture({
            'package.json': '{"scripts":{"dev":"node -e \\"process.exit(1)\\""}}',
        })
        const meta = detectProject(root)
        assert.deepEqual(meta?.scripts, ['dev'])
        assert.equal(JSON.stringify(meta).includes('process.exit'), false)
    })

    it('detects python, go, compose, and django markers without reading bodies', () => {
        const root = fixture({
            'pyproject.toml': '[project]\nname="x"\n',
            'go.mod': 'module example.com/x',
            'compose.yml': 'services:\n  db:\n    image: postgres\n',
            'manage.py': 'print("no")\n',
        })
        const meta = detectProject(root)
        assert.ok(meta?.has?.includes('python'))
        assert.ok(meta?.has?.includes('go'))
        assert.ok(meta?.has?.includes('compose'))
        assert.ok(meta?.has?.includes('django'))
        assert.equal(meta?.scripts, undefined)
    })

    it('returns undefined when nothing allowlisted is present', () => {
        const root = fixture({
            'notes.txt': 'hello',
            '.env': 'SECRET=1',
        })
        assert.equal(detectProject(root), undefined)
    })
})
