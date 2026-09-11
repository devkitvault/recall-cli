import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    detectShellKind,
    findLastSaveableCommand,
    isSelfSaveCommand,
    stripZshExtendedPrefix,
} from './shell-history'

describe('isSelfSaveCommand', () => {
    it('matches recall/rec save', () => {
        assert.equal(isSelfSaveCommand('recall save --last'), true)
        assert.equal(isSelfSaveCommand('rec save "ls"'), true)
        assert.equal(isSelfSaveCommand('  recall save -n foo --last'), true)
    })

    it('does not match other recall commands', () => {
        assert.equal(isSelfSaveCommand('recall list'), false)
        assert.equal(isSelfSaveCommand('rec "start the project"'), false)
        assert.equal(isSelfSaveCommand('docker compose up'), false)
    })
})

describe('stripZshExtendedPrefix', () => {
    it('strips extended history metadata', () => {
        assert.equal(
            stripZshExtendedPrefix(': 1609459200:0;docker compose up -d'),
            'docker compose up -d',
        )
    })

    it('leaves plain lines alone', () => {
        assert.equal(stripZshExtendedPrefix('ls -la'), 'ls -la')
    })
})

describe('findLastSaveableCommand', () => {
    it('returns the last non-recall line', () => {
        const lines = [
            'git status',
            'docker compose up -d',
            'recall save --last',
        ]
        assert.equal(findLastSaveableCommand(lines), 'docker compose up -d')
    })

    it('parses zsh extended history', () => {
        const lines = [
            ': 100:0;echo first',
            ': 200:0;pnpm dev',
            ': 300:0;rec save --last',
        ]
        assert.equal(findLastSaveableCommand(lines), 'pnpm dev')
    })

    it('skips bash timestamp comments', () => {
        const lines = ['#1700000000', 'kubectl get pods', '#1700000001', 'recall save -L']
        assert.equal(findLastSaveableCommand(lines), 'kubectl get pods')
    })

    it('returns null when only save commands exist', () => {
        assert.equal(findLastSaveableCommand(['recall save --last', '']), null)
    })
})

describe('detectShellKind', () => {
    it('detects zsh and bash from SHELL', () => {
        assert.equal(detectShellKind({ SHELL: '/bin/zsh' }, 'darwin'), 'zsh')
        assert.equal(detectShellKind({ SHELL: '/bin/bash' }, 'linux'), 'bash')
    })

    it('detects powershell on windows', () => {
        assert.equal(
            detectShellKind({ ComSpec: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' }, 'win32'),
            'powershell',
        )
    })

    it('detects cmd on windows', () => {
        assert.equal(
            detectShellKind({ ComSpec: 'C:\\Windows\\System32\\cmd.exe', SHELL: undefined }, 'win32'),
            'cmd',
        )
    })
})
