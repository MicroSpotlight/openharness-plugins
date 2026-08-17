import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPluginIntegrity, createCatalog } from '../scripts/build-catalog.mjs'

test('builds the repository catalog deterministically', async () => {
  const options = {
    revision: 'test-revision',
    generatedAt: '2026-08-17T00:00:00.000Z',
  }
  const first = await createCatalog(undefined, options)
  const second = await createCatalog(undefined, options)
  assert.deepEqual(first, second)
  assert.deepEqual(first.plugins.map(plugin => plugin.name), ['openharness-find-plugin'])
  assert.equal(first.plugins[0].distribution.ref.length, 40)
})

test('rejects a descriptor whose folder and name differ', async () => {
  const catalog = await createCatalog(undefined, {
    revision: 'test-revision',
    generatedAt: '2026-08-17T00:00:00.000Z',
  })
  assert.throws(
    () => assertPluginIntegrity(catalog.plugins[0], 'different-folder'),
    /must match descriptor name/,
  )
})

