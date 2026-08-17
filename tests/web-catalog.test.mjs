import assert from 'node:assert/strict'
import test from 'node:test'
import { filterPlugins, parseCatalog } from '../src/catalog.js'

const plugin = {
  name: 'openharness-find-plugin',
  displayName: 'OpenHarness Find Plugin',
  summary: 'Discover curated plugins from the catalog.',
  description: 'Search and inspect curated plugin metadata and source repositories.',
  version: '1.2.0',
  publisher: { name: 'MicroSpotlight', url: 'https://github.com/MicroSpotlight' },
  authors: [{ name: 'MicroSpotlight', url: 'https://github.com/MicroSpotlight' }],
  repository: {
    type: 'git',
    url: 'https://github.com/MicroSpotlight/openharness-find-plugin',
    issues: 'https://github.com/MicroSpotlight/openharness-find-plugin/issues',
  },
  homepage: 'https://github.com/MicroSpotlight/openharness-find-plugin#readme',
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
  localizations: {
    'zh-CN': {
      displayName: 'OpenHarness 插件发现',
      summary: '从目录中查找经过收录的插件。',
    },
  },
}

function catalogWith(pluginValue) {
  return {
    schemaVersion: 1,
    revision: 'test-revision',
    generatedAt: '2026-08-17T00:00:00.000Z',
    plugins: [pluginValue],
  }
}

test('accepts a complete catalog entry', () => {
  const catalog = catalogWith(plugin)
  assert.equal(parseCatalog(catalog), catalog)
})

test('rejects a catalog entry with incomplete permissions', () => {
  const { commands, ...incompletePermissions } = plugin.permissions
  assert.throws(
    () => parseCatalog(catalogWith({ ...plugin, permissions: incompletePermissions })),
    /Catalog plugins are invalid/,
  )
})

test('rejects non-HTTPS repository links before rendering', () => {
  const unsafePlugin = {
    ...plugin,
    repository: { ...plugin.repository, url: 'javascript:alert(1)' },
  }
  assert.throws(() => parseCatalog(catalogWith(unsafePlugin)), /Catalog plugins are invalid/)
})

test('rejects unknown platform values before rendering', () => {
  const unsafePlugin = {
    ...plugin,
    compatibility: { ...plugin.compatibility, platforms: ['web"><script>alert(1)</script>'] },
  }
  assert.throws(() => parseCatalog(catalogWith(unsafePlugin)), /Catalog plugins are invalid/)
})

test('filters catalog results by text and platform', () => {
  assert.deepEqual(filterPlugins([plugin], {
    query: 'discover',
    platform: 'web',
  }), [plugin])
  assert.deepEqual(filterPlugins([plugin], { platform: 'windows' }), [])
})

test('searches localized catalog copy', () => {
  assert.deepEqual(filterPlugins([plugin], { query: '插件发现' }), [plugin])
})

test('filters to plugins that declare OpenHarness compatibility', () => {
  assert.deepEqual(filterPlugins([plugin], { openHarnessOnly: true }), [plugin])
  const withoutOpenHarness = { ...plugin, name: 'dsh-only', compatibility: { ...plugin.compatibility, openharness: undefined } }
  assert.deepEqual(filterPlugins([withoutOpenHarness], { openHarnessOnly: true }), [])
})
