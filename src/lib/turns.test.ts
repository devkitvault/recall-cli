import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isExitCommand, trimTurns } from './turns'

describe('trimTurns', () => {
    it('keeps the last 4 turns and truncates fields', () => {
        const turns = [
            { query: 'one', command: 'echo 1' },
            { query: 'two', command: 'echo 2' },
            { query: 'three', command: 'echo 3' },
            { query: 'four', command: 'echo 4' },
            { query: 'five '.repeat(50), command: 'x'.repeat(250) },
        ]
        const trimmed = trimTurns(turns)
        assert.equal(trimmed.length, 4)
        assert.equal(trimmed[0].query, 'two')
        assert.equal(trimmed[3].query.length, 200)
        assert.equal(trimmed[3].command.length, 200)
    })

    it('drops empty turns', () => {
        assert.deepEqual(trimTurns([
            { query: '  ', command: 'echo' },
            { query: 'ok', command: 'ls' },
        ]), [{ query: 'ok', command: 'ls' }])
        assert.deepEqual(trimTurns([]), [])
    })
})

describe('isExitCommand', () => {
    it('recognizes exit aliases', () => {
        assert.equal(isExitCommand('exit'), true)
        assert.equal(isExitCommand('/quit'), true)
        assert.equal(isExitCommand('start the project'), false)
    })
})
