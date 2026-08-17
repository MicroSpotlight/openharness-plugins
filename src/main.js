import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  Database,
  ExternalLink,
  Files,
  GitFork,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  X,
  createIcons,
} from 'lucide'
import brandIconUrl from './assets/openharness-icon.png'
import {
  displayCopy,
  fetchCatalog,
  filterPlugins,
  permissionLabels,
} from './catalog.js'
import './styles.css'

const CATALOG_URL = import.meta.env.DEV
  ? '/dist/catalog/v1/catalog.json'
  : './catalog/v1/catalog.json'

const ICONS = {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  Database,
  ExternalLink,
  Files,
  GitFork,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  X,
}

const app = document.querySelector('#app')
const locale = navigator.language || 'en'
let searchComposing = false

const state = {
  status: 'loading',
  catalog: undefined,
  query: '',
  category: '',
  platform: '',
  openHarnessOnly: false,
  sort: 'relevance',
  selectedName: '',
  selectedTab: 'overview',
  mobileDetails: false,
  sessionOpen: false,
  error: '',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function pluginIconName(plugin) {
  const values = new Set([...plugin.categories, ...plugin.capabilities])
  if (values.has('search')) return 'search'
  if (values.has('ai') || values.has('agent-preset') || values.has('model-provider')) return 'bot'
  if (values.has('security')) return 'shield-check'
  if (values.has('data')) return 'database'
  if (values.has('web')) return 'globe-2'
  if (values.has('ui-extension')) return 'wand-sparkles'
  if (values.has('developer-tools')) return 'code-2'
  return 'boxes'
}

function categoryTone(plugin) {
  if (plugin.categories.includes('security')) return 'mint'
  if (plugin.categories.includes('ai')) return 'violet'
  if (plugin.categories.includes('data')) return 'cyan'
  if (plugin.categories.includes('web')) return 'blue'
  return 'ink'
}

function relativeTime(value) {
  const elapsed = Date.now() - Date.parse(value)
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'just now'
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function categoryGroups() {
  return [
    {
      title: 'Agent tools',
      items: [
        ['ai', 'AI & models', 'bot'],
        ['automation', 'Automation', 'sparkles'],
        ['communication', 'Communication', 'layers-3'],
      ],
    },
    {
      title: 'Interface',
      items: [
        ['productivity', 'Productivity', 'package-check'],
        ['search', 'Search', 'search'],
        ['web', 'Web', 'globe-2'],
      ],
    },
    {
      title: 'Developer tools',
      items: [
        ['developer-tools', 'Developer tools', 'code-2'],
        ['data', 'Data', 'database'],
        ['files', 'Files', 'files'],
        ['system', 'System', 'terminal-square'],
        ['security', 'Security', 'shield-check'],
      ],
    },
  ]
}

function renderSidebar() {
  const availableCategories = new Set(state.catalog?.plugins.flatMap(plugin => plugin.categories) ?? [])
  const groups = categoryGroups().map(group => ({
    ...group,
    items: group.items.filter(([value]) => availableCategories.has(value)),
  })).filter(group => group.items.length > 0)

  return `
    <aside class="sidebar" aria-label="Plugin catalog navigation">
      <nav class="primary-nav">
        <button class="nav-item ${!state.category ? 'active' : ''}" data-category="">
          <i data-lucide="boxes"></i><span>Catalog</span>
        </button>
      </nav>
      <div class="nav-groups">
        ${groups.map(group => `
          <section>
            <h2>${group.title}</h2>
            ${group.items.map(([value, label, icon]) => `
              <button class="nav-item compact ${state.category === value ? 'active' : ''}" data-category="${value}">
                <i data-lucide="${icon}"></i><span>${label}</span>
              </button>
            `).join('')}
          </section>
        `).join('')}
      </div>
      <a class="nav-item settings-link" href="https://github.com/MicroSpotlight/openharness-plugins#contributing" target="_blank" rel="noreferrer">
        <i data-lucide="settings"></i><span>Contribute</span><i data-lucide="external-link"></i>
      </a>
    </aside>
  `
}

function renderFilters(resultCount) {
  const platforms = [...new Set(state.catalog.plugins.flatMap(plugin => plugin.compatibility.platforms))].sort()
  return `
    <div class="catalog-toolbar">
      <label class="search-field">
        <i data-lucide="search"></i>
        <span class="sr-only">Search plugins</span>
        <input id="plugin-search" type="search" value="${escapeHtml(state.query)}" placeholder="Search plugins" autocomplete="off" />
        ${state.query ? '<button type="button" class="clear-search" data-action="clear-search" aria-label="Clear search"><i data-lucide="x"></i></button>' : '<kbd>/</kbd>'}
      </label>
      <div class="filter-row">
        <label class="select-control">
          <span class="sr-only">Platform</span>
          <select data-filter="platform">
            <option value="">All platforms</option>
            ${platforms.map(platform => `<option value="${escapeHtml(platform)}" ${state.platform === platform ? 'selected' : ''}>${escapeHtml(platform)}</option>`).join('')}
          </select>
          <i data-lucide="chevron-down"></i>
        </label>
        <label class="toggle-control">
          <input type="checkbox" data-filter="openharness" ${state.openHarnessOnly ? 'checked' : ''} />
          <span>OpenHarness compatible</span>
        </label>
        <div class="sync-state" role="status" aria-live="polite"><span class="sync-dot"></span>Synced ${relativeTime(state.catalog.generatedAt)}<span>·</span>${resultCount} ${resultCount === 1 ? 'result' : 'results'}</div>
        <button class="icon-button" data-action="reload" aria-label="Refresh catalog" title="Refresh catalog"><i data-lucide="refresh-cw"></i></button>
        <label class="select-control sort-control">
          <span class="sr-only">Sort plugins</span>
          <select data-filter="sort">
            <option value="relevance" ${state.sort === 'relevance' ? 'selected' : ''}>Sort: Relevance</option>
            <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
            <option value="version" ${state.sort === 'version' ? 'selected' : ''}>Sort: Version</option>
          </select>
          <i data-lucide="chevron-down"></i>
        </label>
      </div>
    </div>
  `
}

function renderPluginRow(plugin) {
  const copy = displayCopy(plugin, locale)
  const permissions = permissionLabels(plugin).slice(0, 2)
  const selected = state.selectedName === plugin.name
  return `
    <button class="plugin-row ${selected ? 'selected' : ''}" data-plugin="${escapeHtml(plugin.name)}" aria-pressed="${selected}">
      <span class="plugin-main">
        <span class="plugin-icon ${categoryTone(plugin)}"><i data-lucide="${pluginIconName(plugin)}"></i></span>
        <span class="plugin-copy"><strong>${escapeHtml(copy.displayName)}</strong><small>${escapeHtml(copy.summary)}</small><em>${escapeHtml(plugin.name)} · ${escapeHtml(plugin.publisher.name)}</em></span>
      </span>
      <span class="cell publisher-cell">${escapeHtml(plugin.publisher.name)}</span>
      <span class="cell version-cell">${escapeHtml(plugin.version)}</span>
      <span class="cell compatibility-cell">${escapeHtml(plugin.compatibility.openharness ?? `DSH ${plugin.compatibility.dsh}`)}</span>
      <span class="cell permissions-cell">${permissions.map(label => `<span class="tag">${escapeHtml(label)}</span>`).join('')}</span>
    </button>
  `
}

function renderList(plugins) {
  if (plugins.length === 0) {
    return `
      <div class="empty-state">
        <i data-lucide="search"></i>
        <h2>No matching plugins</h2>
        <p>Adjust the search or filters to see more of the catalog.</p>
        <button class="secondary-button" data-action="reset-filters">Reset filters</button>
      </div>
    `
  }
  return `
    <div class="plugin-table">
      <div class="table-header" aria-hidden="true">
        <span>Plugin</span><span>Publisher</span><span>Version</span><span>Compatibility</span><span>Permissions</span>
      </div>
      <div class="plugin-list">
        ${plugins.map(plugin => renderPluginRow(plugin)).join('')}
      </div>
    </div>
  `
}

function compatibilityRows(plugin) {
  return [
    ['OpenHarness', plugin.compatibility.openharness ?? 'Not declared'],
    ['DeepSeek Harness', plugin.compatibility.dsh],
    ['Profiles', plugin.compatibility.profiles.join(', ')],
    ['Platforms', plugin.compatibility.platforms.join(', ')],
  ]
}

function permissionRows(plugin) {
  const rows = [
    ['Network', plugin.permissions.network],
    ['Read files', plugin.permissions.filesystemRead],
    ['Write files', plugin.permissions.filesystemWrite],
    ['Environment', plugin.permissions.environment],
    ['Commands', plugin.permissions.commands],
  ]
  return rows.map(([label, values]) => `
    <div class="detail-row permission-row">
      <span>${label}</span>
      <strong>${values.length ? escapeHtml(values.join(', ')) : 'None'}</strong>
    </div>
  `).join('')
}

function renderDetailTab(plugin) {
  const copy = displayCopy(plugin, locale)
  if (state.selectedTab === 'compatibility') {
    return `
      <section class="detail-section">
        <h3>Compatibility</h3>
        <p>Version constraints declared by the plugin publisher and checked by the catalog schema.</p>
        <div class="detail-table">${compatibilityRows(plugin).map(([label, value]) => `<div class="detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>
      </section>
      <section class="detail-section">
        <h3>Capabilities</h3>
        <div class="tag-list">${plugin.capabilities.map(value => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div>
      </section>
    `
  }
  if (state.selectedTab === 'permissions') {
    return `
      <section class="detail-section">
        <h3>Declared permissions</h3>
        <p>These capabilities are declared by the plugin publisher in the catalog descriptor.</p>
        <div class="detail-table">${permissionRows(plugin)}</div>
      </section>
    `
  }
  return `
    <section class="detail-section overview-copy">
      <p>${escapeHtml(copy.description)}</p>
    </section>
    <section class="detail-section split-section">
      <div>
        <h3>Compatibility</h3>
        <div class="mini-list">
          <span><i data-lucide="check-circle-2"></i>DSH ${escapeHtml(plugin.compatibility.dsh)}</span>
          <span><i data-lucide="${plugin.compatibility.openharness ? 'check-circle-2' : 'info'}"></i>${escapeHtml(plugin.compatibility.openharness ? `OpenHarness ${plugin.compatibility.openharness}` : 'OpenHarness range not declared')}</span>
        </div>
      </div>
      <div>
        <h3>Permissions</h3>
        <div class="tag-list">${permissionLabels(plugin).map(value => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div>
      </div>
    </section>
    <section class="detail-section">
      <h3>Catalog trust</h3>
      <div class="trust-list">
        <span><i data-lucide="shield-check"></i>Descriptor passed the catalog schema</span>
        <span><i data-lucide="check-circle-2"></i>${plugin.distribution.type === 'git' ? 'Distribution pinned to an immutable commit' : 'Versioned npm distribution'}</span>
        <span><i data-lucide="package-check"></i>Package: ${escapeHtml(plugin.distribution.package)} · ${escapeHtml(plugin.version)}</span>
      </div>
    </section>
    <section class="detail-section metadata-grid">
      <a href="${escapeHtml(plugin.repository.url)}" target="_blank" rel="noreferrer"><span><i data-lucide="git-fork"></i>Repository</span><i data-lucide="external-link"></i></a>
      <a href="${escapeHtml(plugin.repository.issues)}" target="_blank" rel="noreferrer"><span><i data-lucide="circle-help"></i>Issues</span><i data-lucide="external-link"></i></a>
      <a href="${escapeHtml(plugin.homepage)}" target="_blank" rel="noreferrer"><span><i data-lucide="globe-2"></i>Homepage</span><i data-lucide="external-link"></i></a>
      <div><span>Publisher</span><strong>${escapeHtml(plugin.publisher.name)}</strong></div>
      <div><span>License</span><strong>${escapeHtml(plugin.license)}</strong></div>
      <div><span>Version</span><strong>${escapeHtml(plugin.version)}</strong></div>
    </section>
  `
}

function renderDetails(plugin) {
  if (!plugin) {
    return '<aside class="detail-panel empty-detail"><i data-lucide="package-check"></i><p>Select a plugin to inspect its compatibility and permissions.</p></aside>'
  }
  const copy = displayCopy(plugin, locale)
  return `
    <aside class="detail-panel ${state.mobileDetails ? 'mobile-open' : ''}" aria-label="Plugin details">
      <button class="detail-close" data-action="close-details" aria-label="Close plugin details"><i data-lucide="x"></i></button>
      <div class="detail-header">
        <span class="plugin-icon large ${categoryTone(plugin)}"><i data-lucide="${pluginIconName(plugin)}"></i></span>
        <div><h2>${escapeHtml(copy.displayName)}</h2><p>${escapeHtml(plugin.repository.url.replace('https://github.com/', ''))}</p></div>
      </div>
      <a class="primary-button detail-action" href="${escapeHtml(plugin.repository.url)}" target="_blank" rel="noreferrer"><i data-lucide="git-fork"></i>View repository</a>
      <div class="detail-tabs" role="tablist">
        ${[['overview', 'Overview'], ['compatibility', 'Compatibility'], ['permissions', 'Permissions']].map(([value, label]) => `<button id="plugin-tab-${value}" role="tab" aria-controls="plugin-detail-tabpanel" aria-selected="${state.selectedTab === value}" class="${state.selectedTab === value ? 'active' : ''}" data-tab="${value}">${label}</button>`).join('')}
      </div>
      <div id="plugin-detail-tabpanel" class="detail-content" role="tabpanel" aria-labelledby="plugin-tab-${state.selectedTab}">${renderDetailTab(plugin)}</div>
    </aside>
  `
}

function renderApp(options = {}) {
  const preserveSearch = options.preserveSearch === true
  const searchElement = document.querySelector('#plugin-search')
  const selectionStart = preserveSearch && searchElement === document.activeElement ? searchElement.selectionStart : null

  if (state.status === 'loading') {
    app.innerHTML = `<main class="load-screen"><img src="${brandIconUrl}" alt="" /><i data-lucide="loader-circle" class="spin"></i><p>Loading the plugin catalog…</p></main>`
    activateIcons()
    return
  }
  if (state.status === 'error') {
    app.innerHTML = `<main class="load-screen error-screen"><img src="${brandIconUrl}" alt="" /><h1>Catalog unavailable</h1><p>${escapeHtml(state.error)}</p><button class="secondary-button" data-action="reload">Try again</button></main>`
    activateIcons()
    return
  }

  const plugins = filterPlugins(state.catalog.plugins, {
    query: state.query,
    category: state.category,
    platform: state.platform,
    openHarnessOnly: state.openHarnessOnly,
    sort: state.sort,
  })
  if (!plugins.some(plugin => plugin.name === state.selectedName)) state.selectedName = plugins[0]?.name ?? ''
  const selected = state.catalog.plugins.find(plugin => plugin.name === state.selectedName)

  app.innerHTML = `
    <header class="global-header">
      <a class="brand" href="./" aria-label="OpenHarness Plugins home"><img src="${brandIconUrl}" alt="" /><span>OpenHarness</span><b>Plugins</b></a>
      <span class="header-context">Plugin catalog</span>
      <nav aria-label="Global navigation">
        <a href="https://github.com/MicroSpotlight/openharness-plugins" target="_blank" rel="noreferrer"><i data-lucide="git-fork"></i>GitHub</a>
        <a href="https://github.com/MicroSpotlight/openharness-plugins/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">Submit plugin<i data-lucide="external-link"></i></a>
        <button class="session-button" data-action="toggle-session"><i data-lucide="activity"></i>Catalog status</button>
      </nav>
      ${state.sessionOpen ? `<div class="session-popover"><strong>Public plugin catalog</strong><span>Read-only metadata generated from reviewed plugin descriptors.</span><code>${escapeHtml(state.catalog.revision.slice(0, 12))}</code></div>` : ''}
    </header>
    <main class="app-shell">
      ${renderSidebar()}
      <section class="catalog-panel">
        <div class="catalog-heading"><div><p>Browse and inspect</p><h1>Plugin catalog</h1></div><span class="schema-badge"><i data-lucide="shield-check"></i>Schema v${state.catalog.schemaVersion}</span></div>
        ${renderFilters(plugins.length)}
        ${renderList(plugins)}
        <div class="identity-note"><i data-lucide="info"></i><span><strong>Catalog metadata.</strong> Review each plugin's repository, compatibility, declared permissions, and pinned distribution source.</span></div>
      </section>
      ${renderDetails(selected)}
    </main>
  `
  activateIcons()
  if (selectionStart !== null) {
    const input = document.querySelector('#plugin-search')
    input?.focus()
    input?.setSelectionRange(selectionStart, selectionStart)
  }
}

function activateIcons() {
  createIcons({ icons: ICONS, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.8 } })
}

async function loadCatalog() {
  state.status = 'loading'
  state.error = ''
  renderApp()
  try {
    state.catalog = await fetchCatalog(CATALOG_URL)
    state.selectedName = state.catalog.plugins[0]?.name ?? ''
    state.status = 'ready'
  } catch (error) {
    state.status = 'error'
    state.error = error instanceof Error ? error.message : String(error)
  }
  renderApp()
}

app.addEventListener('compositionstart', event => {
  if (event.target.matches('#plugin-search')) searchComposing = true
})

app.addEventListener('compositionend', event => {
  if (!event.target.matches('#plugin-search')) return
  searchComposing = false
  state.query = event.target.value
  renderApp({ preserveSearch: true })
})

app.addEventListener('input', event => {
  if (event.target.matches('#plugin-search')) {
    if (event.isComposing || searchComposing) return
    state.query = event.target.value
    renderApp({ preserveSearch: true })
  }
})

app.addEventListener('change', event => {
  if (event.target.matches('[data-filter="platform"]')) state.platform = event.target.value
  if (event.target.matches('[data-filter="sort"]')) state.sort = event.target.value
  if (event.target.matches('[data-filter="openharness"]')) state.openHarnessOnly = event.target.checked
  renderApp()
})

app.addEventListener('click', event => {
  const control = event.target.closest('button, a')
  if (!control) return
  if (control.matches('[data-plugin].plugin-row')) {
    state.selectedName = control.dataset.plugin
    state.selectedTab = 'overview'
    state.mobileDetails = true
    renderApp()
    return
  }
  if (control.dataset.tab) {
    state.selectedTab = control.dataset.tab
    renderApp()
    return
  }
  if (control.hasAttribute('data-category')) {
    state.category = control.dataset.category ?? ''
    renderApp()
    return
  }
  const action = control.dataset.action
  if (action === 'clear-search') state.query = ''
  if (action === 'reset-filters') Object.assign(state, { query: '', category: '', platform: '', openHarnessOnly: false })
  if (action === 'reload') void loadCatalog()
  if (action === 'toggle-session') state.sessionOpen = !state.sessionOpen
  if (action === 'close-details') state.mobileDetails = false
  if (action && action !== 'reload') renderApp()
})

window.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault()
    document.querySelector('#plugin-search')?.focus()
  }
  if (event.key === 'Escape' && state.mobileDetails) {
    state.mobileDetails = false
    renderApp()
  }
})

void loadCatalog()
