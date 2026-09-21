import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const routes = [
  ['GET', '/companies/managed'],
  ['GET', '/companies'],
  ['POST', '/companies'],
  ['PATCH', '/companies/1'],
  ['GET', '/companies/1/users?page=1'],
  ['PATCH', '/companies/1/users/2'],
  ['DELETE', '/companies/1/users/2'],
  ['GET', '/users?status=active&page=1'],
  ['GET', '/users?status=pending&page=1'],
  ['GET', '/users/2'],
  ['PATCH', '/users/2/company-access'],
  ['PATCH', '/users/2/access'],
  ['GET', '/auth/companies'],
  ['POST', '/auth/request-access'],
]

test('build incorpora a base central em todas as chamadas de administração, CSRF e SSE', async t => {
  const envDir = await mkdtemp(join(tmpdir(), 'paytrack-api-build-'))
  const originalEnv = process.env.VITE_API_URL
  const originalNodeEnv = process.env.NODE_ENV
  const originalFetch = globalThis.fetch
  const originalEvents = globalThis.EventSource
  t.after(async () => {
    if (originalEnv === undefined) delete process.env.VITE_API_URL
    else process.env.VITE_API_URL = originalEnv
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEvents
    await rm(envDir, { recursive: true, force: true })
  })
  delete process.env.VITE_API_URL
  const compile = () => build({
    root, envDir, mode: 'production', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: {
      entry: join(root, 'src/services/api.js'), formats: ['es'], fileName: 'api',
    } },
  })

  await assert.rejects(compile(), /Defina VITE_API_URL antes do build/)
  await writeFile(join(envDir, '.env.production'), 'VITE_API_URL=https://backend.example.test/api/\n')

  // First use .env.production, then prove process env wins (same-origin proxy).
  for (const base of ['https://backend.example.test/api', '/api']) {
    if (base === '/api') process.env.VITE_API_URL = base
    const result = await compile()
    const output = Array.isArray(result) ? result[0].output : result.output
    const code = output.find(output => output.type === 'chunk').code
    const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const calls = []
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return { ok: true, status: 200, json: async () => ({ csrfToken: 'build-csrf' }) }
    }
    for (const [method, path] of routes) {
      await api.request(path, { method, ...(method === 'GET' ? {} : { body: {} }) })
      const { url, options } = calls.at(-1)
      assert.equal(url, `${base}${path}`)
      assert.equal(options.method, method)
      assert.equal(options.credentials, 'include')
      if (method !== 'GET') assert.equal(options.headers['X-CSRF-Token'], 'build-csrf')
    }
    assert.equal(calls.filter(call => call.url === `${base}/auth/csrf`).length, 1)
    let closed = false
    globalThis.EventSource = class {
      constructor(url, options) {
        assert.equal(url, `${base}/users/events`)
        assert.equal(options.withCredentials, true)
      }
      close() { closed = true }
    }
    api.watchAccessChanges(() => {})()
    assert.equal(closed, true)
  }
})
