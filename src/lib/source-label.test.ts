import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sourceLabel } from './source-label'

describe('sourceLabel', () => {
    it('maps llm to recall agent and leaves other sources unchanged', () => {
        assert.equal(sourceLabel('llm'), 'recall agent')
        assert.equal(sourceLabel('cache'), 'cache')
        assert.equal(sourceLabel('vault'), 'vault')
        assert.equal(sourceLabel('project'), 'project')
    })
})
