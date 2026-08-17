import assert from 'node:assert/strict'
import test from 'node:test'
import { filterPlugins } from '../src/catalog.js'

const plugin = {
  name: 'openharness-find-plugin',
  displayName: 'OpenHarness Find Plugin',
  summary: 'Discover curated plugins from the catalog.',
  description: 'Search and inspect curated plugin metadata and source repositories.',
  version: '1.2.0',
  publisher: { name: 'MicroSpotlight' },
  repository: { url: 'https://github.com/MicroSpotlight/openharness-find-plugin' },
  distribution: {
    type: 'git',
    package: '@microspotlight/openharness-find-plugin',
    url: 'https://github.com/MicroSpotlight/openharness-find-plugin.git',
    ref: 'a'.repeat(40),
  },
  compatibility: { dsh: '>=0.1.0', openharness: '>=0.1.0', profiles: ['web'], platforms: ['web', 'node'] },
  capabilities: ['ui-extension'],
  categories: ['developer-tools', 'search'],
  keywords: ['catalog', 'discovery'],
  permissions: { network: [], filesystemRead: [], filesystemWrite: [], environment: [], commands: [] },
  license: 'Apache-2.0',
}

test('filters catalog results by text and platform', () => {
  assert.deepEqual(filterPlugins([plugin], {
    query: 'discover',
    platform: 'web',
  }), [plugin])
  assert.deepEqual(filterPlugins([plugin], { platform: 'windows' }), [])
})

test('filters to plugins that declare OpenHarness compatibility', () => {
  assert.deepEqual(filterPlugins([plugin], { openHarnessOnly: true }), [plugin])
  const withoutOpenHarness = { ...plugin, name: 'dsh-only', compatibility: { ...plugin.compatibility, openharness: undefined } }
  assert.deepEqual(filterPlugins([withoutOpenHarness], { openHarnessOnly: true }), [])
})
