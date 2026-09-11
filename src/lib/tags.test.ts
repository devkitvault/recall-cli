import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatSavedMessage, parseTags } from './tags'

describe('parseTags', () => {
    it('splits on commas and trims', () => {
        assert.deepEqual(parseTags('docker, wordpress'), ['docker', 'wordpress'])
    })

    it('drops empty segments', () => {
        assert.deepEqual(parseTags(' git, ,polylang , '), ['git', 'polylang'])
    })

    it('returns undefined when nothing remains', () => {
        assert.equal(parseTags(undefined), undefined)
        assert.equal(parseTags(''), undefined)
        assert.equal(parseTags('  ,  '), undefined)
    })
})

describe('formatSavedMessage', () => {
    it('echoes name and tags after Ask save', () => {
        assert.equal(formatSavedMessage('pll-home', ['polylang', 'homepage']), 'Saved as "pll-home" [polylang, homepage].')
        assert.equal(formatSavedMessage('wp-up', undefined), 'Saved as "wp-up".')
        assert.equal(formatSavedMessage('  ', ['docker']), 'Saved [docker].')
        assert.equal(formatSavedMessage(undefined, undefined), 'Saved.')
    })
})
