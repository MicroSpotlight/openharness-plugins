const MAX_CATALOG_BYTES = 2 * 1024 * 1024
const PLATFORMS = new Set(['web', 'node', 'macos', 'windows', 'linux'])
const CAPABILITIES = new Set([
  'agent-preset',
  'command',
  'context-provider',
  'event-handler',
  'model-provider',
  'prompt-provider',
  'tool-provider',
  'ui-extension',
  'workflow',
])
const CATEGORIES = new Set([
  'ai',
  'automation',
  'communication',
  'data',
  'developer-tools',
  'files',
  'productivity',
  'search',
  'security',
  'system',
  'web',
])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function hasAllowedStrings(value, allowed) {
  return hasStrings(value) && value.length > 0 && value.every(item => allowed.has(item))
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isPerson(value) {
  return isRecord(value) && isNonEmptyString(value.name) && isHttpsUrl(value.url)
}

function hasLocalizations(value) {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  return Object.values(value).every(copy => isRecord(copy)
    && Object.keys(copy).length > 0
    && Object.entries(copy).every(([key, text]) => (
      ['displayName', 'summary', 'description'].includes(key) && isNonEmptyString(text)
    )))
}

function isPlugin(value) {
  if (!isRecord(value) || !isRecord(value.publisher) || !isRecord(value.repository)) return false
  if (!isRecord(value.distribution) || !isRecord(value.compatibility) || !isRecord(value.permissions)) return false
  if (!['name', 'displayName', 'summary', 'description', 'version', 'license'].every(key => isNonEmptyString(value[key]))) return false
  if (!hasAllowedStrings(value.categories, CATEGORIES) || !hasAllowedStrings(value.capabilities, CAPABILITIES) || !hasStrings(value.keywords)) return false
  if (!Array.isArray(value.authors) || value.authors.length === 0 || !value.authors.every(isPerson)) return false
  if (!isPerson(value.publisher) || value.repository.type !== 'git') return false
  if (!isHttpsUrl(value.repository.url) || !isHttpsUrl(value.repository.issues) || !isHttpsUrl(value.homepage)) return false
  if (!['npm', 'git'].includes(value.distribution.type) || !isNonEmptyString(value.distribution.package)) return false
  if (value.distribution.type === 'git' && (!isHttpsUrl(value.distribution.url) || !/^[0-9a-f]{40}$/.test(value.distribution.ref))) return false
  if (!isNonEmptyString(value.compatibility.dsh) || (value.compatibility.openharness !== undefined && !isNonEmptyString(value.compatibility.openharness))) return false
  if (!hasStrings(value.compatibility.profiles) || value.compatibility.profiles.length === 0) return false
  if (!hasAllowedStrings(value.compatibility.platforms, PLATFORMS)) return false
  const permissionKeys = ['network', 'filesystemRead', 'filesystemWrite', 'environment', 'commands']
  if (!permissionKeys.every(key => hasStrings(value.permissions[key]))) return false
  if (!value.permissions.network.every(isHttpsUrl)) return false
  return hasLocalizations(value.localizations)
}

export function parseCatalog(value) {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('Unsupported catalog schema')
  if (typeof value.revision !== 'string' || !value.revision) throw new Error('Catalog revision is missing')
  if (Number.isNaN(Date.parse(value.generatedAt))) throw new Error('Catalog generatedAt is invalid')
  if (!Array.isArray(value.plugins) || !value.plugins.every(isPlugin)) throw new Error('Catalog plugins are invalid')
  return value
}

export async function fetchCatalog(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_CATALOG_BYTES) throw new Error('Catalog is too large')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_CATALOG_BYTES) throw new Error('Catalog is too large')
  return parseCatalog(JSON.parse(text))
}

function compareVersions(left, right) {
  const parse = value => /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(value)
  const leftMatch = parse(left)
  const rightMatch = parse(right)
  if (!leftMatch || !rightMatch) return 0
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index])
    if (difference !== 0) return difference
  }
  if (leftMatch[4] === rightMatch[4]) return 0
  if (leftMatch[4] === undefined) return 1
  if (rightMatch[4] === undefined) return -1
  return leftMatch[4].localeCompare(rightMatch[4], undefined, { numeric: true })
}

function normalizedText(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function searchScore(plugin, query) {
  if (!query) return 1
  const name = normalizedText(plugin.name)
  const displayName = normalizedText(plugin.displayName)
  const localizedCopy = Object.values(plugin.localizations ?? {})
    .flatMap(copy => Object.values(copy))
  const haystack = [
    plugin.summary,
    plugin.description,
    plugin.publisher.name,
    ...plugin.keywords,
    ...plugin.categories,
    ...plugin.capabilities,
    ...localizedCopy,
  ].map(normalizedText)
  if (name === query || displayName === query) return 100
  if (name.startsWith(query) || displayName.startsWith(query)) return 60
  if (name.includes(query) || displayName.includes(query)) return 40
  return haystack.some(value => value.includes(query)) ? 10 : 0
}

export function filterPlugins(plugins, options = {}) {
  const query = normalizedText(options.query)
  const category = normalizedText(options.category)
  const platform = normalizedText(options.platform)
  const results = plugins
    .map(plugin => ({ plugin, score: searchScore(plugin, query) }))
    .filter(({ plugin, score }) => {
      if (score === 0) return false
      if (category && !plugin.categories.some(value => normalizedText(value) === category)) return false
      if (platform && !plugin.compatibility.platforms.some(value => normalizedText(value) === platform)) return false
      if (options.openHarnessOnly && !plugin.compatibility.openharness) return false
      return true
    })

  const sort = options.sort ?? 'relevance'
  results.sort((left, right) => {
    if (sort === 'name') return left.plugin.displayName.localeCompare(right.plugin.displayName)
    if (sort === 'version') return compareVersions(right.plugin.version, left.plugin.version)
    return right.score - left.score || left.plugin.displayName.localeCompare(right.plugin.displayName)
  })
  return results.map(({ plugin }) => plugin)
}

export function displayCopy(plugin, locale = 'en') {
  const normalizedLocale = locale.toLocaleLowerCase()
  const localizationKey = Object.keys(plugin.localizations ?? {})
    .find(key => normalizedLocale === key.toLocaleLowerCase() || normalizedLocale.startsWith(`${key.toLocaleLowerCase()}-`))
  const localized = localizationKey ? plugin.localizations[localizationKey] : undefined
  return {
    displayName: localized?.displayName ?? plugin.displayName,
    summary: localized?.summary ?? plugin.summary,
    description: localized?.description ?? plugin.description,
  }
}

export function permissionLabels(plugin) {
  const permissions = plugin.permissions
  const labels = []
  if (permissions.network.length > 0) labels.push('Network')
  if (permissions.filesystemRead.length > 0) labels.push('Files: read')
  if (permissions.filesystemWrite.length > 0) labels.push('Files: write')
  if (permissions.environment.length > 0) labels.push('Environment')
  if (permissions.commands.length > 0) labels.push('Commands')
  return labels.length > 0 ? labels : ['No elevated access']
}
