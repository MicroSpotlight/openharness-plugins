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
    const packageResult = await execFileAsync('git', ['-C', directory, 'show', 'FETCH_HEAD:package.json'])
    const packageJson = JSON.parse(packageResult.stdout)
    if (packageJson.name !== plugin.distribution.package) {
      throw new Error(`package.json name ${packageJson.name ?? '<missing>'} does not match ${plugin.distribution.package}`)
    }
    if (typeof packageJson.main !== 'string'
      || packageJson.main.includes('..')
      || !/^(?:\.\/)?[A-Za-z0-9_./-]+$/.test(packageJson.main)) {
      throw new Error('package.json must declare a safe relative main entry')
    }
    const entry = packageJson.main.replace(/^\.\//, '')
    await execFileAsync('git', ['-C', directory, 'cat-file', '-e', `FETCH_HEAD:${entry}`])
    if (typeof packageJson.dsh !== 'object' || packageJson.dsh === null) {
      throw new Error('package.json does not declare DSH metadata')
    }
    const lifecycleScripts = ['preinstall', 'install', 'postinstall', 'prepare']
      .filter(name => typeof packageJson.scripts?.[name] === 'string')
    if (lifecycleScripts.length > 0) {
      throw new Error(`Git distribution must be install-ready; blocked lifecycle scripts: ${lifecycleScripts.join(', ')}`)
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
