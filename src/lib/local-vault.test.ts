import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

describe('local-vault', () => {
    let tmpRoot = ''
    let vault: typeof import('./local-vault')

    beforeEach(async () => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-vault-'))
        process.env.RECALL_HOME = tmpRoot
        // Fresh module per test so VAULT_DIR picks up RECALL_HOME
        const resolved = require.resolve('./local-vault')
        delete require.cache[resolved]
        vault = require('./local-vault') as typeof import('./local-vault')
    })

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true })
        delete process.env.RECALL_HOME
        const resolved = require.resolve('./local-vault')
        delete require.cache[resolved]
    })

    it('saves and finds by name without cloud id', () => {
        const saved = vault.saveLocalCommand({
            command: 'docker compose up -d',
            name: 'up',
            tags: ['docker'],
        })
        assert.equal(saved.name, 'up')
        assert.equal(saved.cloudId, undefined)
        assert.equal(vault.findLocalByName('up')?.command, 'docker compose up -d')
        assert.equal(vault.localCommandsNeedingPush().length, 1)
    })

    it('updates existing name in place', () => {
        vault.saveLocalCommand({ command: 'echo a', name: 'hi' })
        const again = vault.saveLocalCommand({ command: 'echo b', name: 'hi' })
        assert.equal(again.command, 'echo b')
        assert.equal(vault.listLocalCommands().length, 1)
    })

    it('pins and deletes', () => {
        vault.saveLocalCommand({ command: 'echo x', name: 'x' })
        vault.setLocalPinned('x', true)
        assert.equal(vault.findLocalByName('x')?.pinned, true)
        vault.deleteLocalByName('x')
        assert.equal(vault.findLocalByName('x'), undefined)
    })

    it('merges cloud rows and attaches cloudId', () => {
        const local = vault.saveLocalCommand({ command: 'echo local', name: 'solo' })
        vault.mergeCloudIntoLocal([
            {
                id: '11111111-1111-1111-1111-111111111111',
                command: 'echo cloud',
                name: 'cloud',
                tags: ['c'],
            },
        ])
        assert.equal(vault.findLocalByName('cloud')?.cloudId, '11111111-1111-1111-1111-111111111111')
        assert.ok(vault.findLocalByName('solo'))
        vault.attachCloudId(local.id, '22222222-2222-2222-2222-222222222222')
        assert.equal(vault.findLocalByName('solo')?.cloudId, '22222222-2222-2222-2222-222222222222')
        assert.equal(vault.localCommandsNeedingPush().length, 0)
        assert.equal(vault.readVault().version, 1)
    })
})
