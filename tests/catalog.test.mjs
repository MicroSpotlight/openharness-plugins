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
  const names = first.plugins.map(plugin => plugin.name)
  assert.deepEqual(names, [...names].sort())
  assert.ok(names.includes('openharness-find-plugin'))
  assert.deepEqual(
    first.plugins.find(plugin => plugin.name === 'openharness-find-plugin').distribution,
    { type: 'npm', package: '@microspotlight/openharness-find-plugin' },
  )
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
