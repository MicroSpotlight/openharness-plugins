const MAX_CATALOG_BYTES = 2 * 1024 * 1024

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isPlugin(value) {
  if (!isRecord(value) || !isRecord(value.publisher) || !isRecord(value.repository)) return false
  if (!isRecord(value.distribution) || !isRecord(value.compatibility) || !isRecord(value.permissions)) return false
  if (!['name', 'displayName', 'summary', 'description', 'version', 'license'].every(key => typeof value[key] === 'string')) return false
  if (!hasStrings(value.categories) || !hasStrings(value.capabilities) || !hasStrings(value.keywords)) return false
  return typeof value.publisher.name === 'string'
    && typeof value.repository.url === 'string'
    && typeof value.distribution.package === 'string'
    && hasStrings(value.compatibility.platforms)
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
  const haystack = [
    plugin.summary,
    plugin.description,
    plugin.publisher.name,
    ...plugin.keywords,
    ...plugin.categories,
    ...plugin.capabilities,
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
