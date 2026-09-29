import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAdminister, canManageCompany, companyDecisions } from '../src/features/auth/companyAccess.js'
import { watchAccessChanges } from '../src/services/api.js'

test('desconexão do SSE revalida acesso e limpeza encerra a assinatura', t => {
  let stream, refreshes = 0, closed = false
  const original = globalThis.EventSource
  t.after(() => { globalThis.EventSource = original })
  globalThis.EventSource = class {
    constructor(url, options) {
      assert.equal(url, '/api/users/events')
      assert.equal(options.withCredentials, true)
      stream = this
    }
    close() { closed = true }
  }
  const stop = watchAccessChanges(() => { refreshes++ })
  stream.onopen()
  assert.equal(refreshes, 0)
  stream.onmessage()
  stream.onerror()
  assert.equal(refreshes, 2)
  stream.onopen()
  assert.equal(refreshes, 3)
  stop()
  assert.equal(closed, true)
})

test('desconexão pode revalidar sessão sem recarregar listas; reconexão sincroniza mudanças perdidas', t => {
  const original = globalThis.EventSource
  let stream, refreshes = 0, checks = 0
  t.after(() => { globalThis.EventSource = original })
  globalThis.EventSource = class { constructor() { stream = this } close() {} }
  const stop = watchAccessChanges(() => refreshes++, () => checks++)
  // Also recover when the very first connection fails after the initial list load.
  stream.onerror()
  stream.onerror()
  assert.equal(refreshes,0)
  assert.equal(checks,2)
  stream.onopen()
  assert.equal(refreshes,1)
  stop()
})

test('administra somente com nível global ou empresas gerenciadas; USER não ganha poderes', () => {
  assert.equal(canAdminister(null), false)
  assert.equal(canAdminister({ role: 'user', companyIds: [1], managedCompanyIds: [] }), false)
  assert.equal(canAdminister({ role: 'admin' }), true)
  const manager = { role: 'user', companyIds: [1, 2], managedCompanyIds: [1] }
  assert.equal(canAdminister(manager), true)
  assert.equal(canManageCompany(manager, 1), true)
  assert.equal(canManageCompany(manager, 2), false)
  assert.equal(canManageCompany({ role: 'admin' }, 2), true)
})

test('decisões mantêm empresas não selecionadas pendentes e atribuem nível apenas na aprovação', () => {
  const rows = [1, 2, 3, 4].map(id => ({ id, status: id === 4 ? 'approved' : 'pending' }))
  assert.deepEqual(companyDecisions(rows, {
    1: { action: 'approve', role: 'MANAGER' },
    2: { action: 'reject', role: 'MANAGER' },
    3: { action: '' },
    4: { action: 'reject' },
    99: { action: 'approve' },
  }), [{ companyId: 1, action: 'approve', role: 'MANAGER' }, { companyId: 2, action: 'reject' }])
  assert.deepEqual(companyDecisions(rows, { 1: { action: 'approve' } }), [{ companyId: 1, action: 'approve', role: 'USER' }])
  assert.deepEqual(companyDecisions(rows, {}), [])
})
