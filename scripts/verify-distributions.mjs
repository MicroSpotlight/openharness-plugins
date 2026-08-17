import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { collectPlugins } from './build-catalog.mjs'

const execFileAsync = promisify(execFile)

async function verifyGit(plugin) {
  const directory = await mkdtemp(join(tmpdir(), 'openharness-plugin-ref-'))
  try {
    await execFileAsync('git', ['init', '--quiet', directory])
    await execFileAsync('git', [
      '-C', directory,
      'fetch', '--quiet', '--depth=1', '--no-tags',
      plugin.distribution.url,
      plugin.distribution.ref,
    ])
    const { stdout } = await execFileAsync('git', ['-C', directory, 'rev-parse', 'FETCH_HEAD'])
    if (stdout.trim() !== plugin.distribution.ref) {
      throw new Error(`resolved to ${stdout.trim()}`)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function verifyNpm(plugin) {
  const spec = `${plugin.distribution.package}@${plugin.version}`
  const { stdout } = await execFileAsync('npm', ['view', spec, 'version', '--json'])
  if (JSON.parse(stdout) !== plugin.version) throw new Error(`npm does not expose ${spec}`)
}

async function main() {
  const plugins = await collectPlugins()
  for (const plugin of plugins) {
    try {
      if (plugin.distribution.type === 'git') await verifyGit(plugin)
      else await verifyNpm(plugin)
      process.stdout.write(`Verified ${plugin.name}@${plugin.version}\n`)
    } catch (error) {
      throw new Error(`Cannot resolve distribution for ${plugin.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

