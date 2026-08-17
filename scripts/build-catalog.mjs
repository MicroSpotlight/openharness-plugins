import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const execFileAsync = promisify(execFile)
export const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function validationMessage(errors) {
  return (errors ?? [])
    .map(error => `${error.instancePath || '/'} ${error.message}`)
    .join('; ')
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function createValidators(root = repositoryRoot) {
  const pluginSchema = await readJson(join(root, 'schemas/plugin-v1.schema.json'))
  const catalogSchema = await readJson(join(root, 'schemas/catalog-v1.schema.json'))
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  ajv.addSchema(pluginSchema)
  ajv.addSchema(catalogSchema)
  return {
    plugin: ajv.getSchema(pluginSchema.$id),
    catalog: ajv.getSchema(catalogSchema.$id),
  }
}

export function assertPluginIntegrity(plugin, folderName) {
  if (plugin.name !== folderName) {
    throw new Error(`Plugin folder ${folderName} must match descriptor name ${plugin.name}`)
  }
  if (plugin.distribution.type === 'git' && plugin.distribution.ref.length !== 40) {
    throw new Error(`Plugin ${plugin.name} must pin a full Git commit SHA`)
  }
}

export async function collectPlugins(root = repositoryRoot) {
  const validators = await createValidators(root)
  const pluginsRoot = join(root, 'plugins')
  const directories = (await readdir(pluginsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
  if (directories.length === 0) throw new Error('The plugins directory is empty')

  const seen = new Set()
  const plugins = []
  for (const directory of directories) {
    const descriptorPath = join(pluginsRoot, directory.name, 'plugin.json')
    const plugin = await readJson(descriptorPath)
    if (!validators.plugin(plugin)) {
      throw new Error(`${relative(root, descriptorPath)} is invalid: ${validationMessage(validators.plugin.errors)}`)
    }
    assertPluginIntegrity(plugin, directory.name)
    if (seen.has(plugin.name)) throw new Error(`Duplicate plugin name: ${plugin.name}`)
    seen.add(plugin.name)
    plugins.push(plugin)
  }
  return plugins
}

async function localRevision(root) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
    return stdout.trim()
  } catch {
    return 'local'
  }
}

function generatedAt() {
  const epoch = process.env.SOURCE_DATE_EPOCH
  return epoch === undefined ? new Date().toISOString() : new Date(Number(epoch) * 1000).toISOString()
}

export async function createCatalog(root = repositoryRoot, options = {}) {
  const plugins = await collectPlugins(root)
  const catalog = {
    schemaVersion: 1,
    revision: options.revision ?? process.env.CATALOG_REVISION ?? await localRevision(root),
    generatedAt: options.generatedAt ?? generatedAt(),
    plugins,
  }
  const { catalog: validateCatalog } = await createValidators(root)
  if (!validateCatalog(catalog)) {
    throw new Error(`Generated catalog is invalid: ${validationMessage(validateCatalog.errors)}`)
  }
  return catalog
}

export async function writeDistribution(catalog, root = repositoryRoot) {
  const dist = join(root, 'dist')
  await rm(dist, { recursive: true, force: true })
  await mkdir(join(dist, 'catalog/v1'), { recursive: true })
  await mkdir(join(dist, 'schemas'), { recursive: true })
  await writeFile(join(dist, '.nojekyll'), '')
  await writeFile(join(dist, 'catalog/v1/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  await copyFile(join(root, 'schemas/plugin-v1.schema.json'), join(dist, 'schemas/plugin-v1.schema.json'))
  await copyFile(join(root, 'schemas/catalog-v1.schema.json'), join(dist, 'schemas/catalog-v1.schema.json'))
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const catalog = await createCatalog()
  if (!checkOnly) await writeDistribution(catalog)
  process.stdout.write(`${checkOnly ? 'Validated' : 'Built'} ${catalog.plugins.length} plugin(s) at revision ${catalog.revision}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

