import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import '../../../backend/tests/setup-env.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = 'http://127.0.0.1:5192'
const password = 'TestePayTrack123'
const generalTitle = 'Sistema temporariamente indisponível'
const adminTitle = 'Pagamento não efetuado'

async function login(page, name) {
  await page.getByLabel('E-mail', { exact:true }).fill(name + '@qa.test')
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name:'Entrar', exact:true }).click()
}

test('bloqueio após autenticação, sessão aberta, URLs e retorno ao serviço', { timeout: 120000 }, async t => {
  process.env.FRONTEND_ORIGIN = url
  process.env.VITE_API_URL = '/api'
  const { env } = await import('../../../backend/src/config/env.js')
  assert.equal(env.SERVICE_LOCK_ENABLED, false)
  const { app } = await import('../../../backend/src/app.js')
  const { openDatabase, closeDatabase } = await import('../../../backend/src/config/database.js')
  const { insertUser } = await import('../../../backend/src/modules/auth/auth.repository.js')
  const { hashPassword } = await import('../../../backend/src/modules/auth/auth.service.js')
  const { setMembership } = await import('../../../backend/src/modules/companies/companies.repository.js')
  let api, vite, browser
  t.after(async () => {
    await browser?.close()
    await vite?.close()
    if (api) {
      api.closeAllConnections()
      await new Promise(resolve => api.close(resolve))
    }
    await closeDatabase()
  })
  await openDatabase(':memory:')
  const passwordHash = await hashPassword(password)
  for (const [name, role, membership] of [['admin', 'admin'], ['gerente', 'user', 'MANAGER'], ['usuario', 'user', 'USER']]) {
    const id = await insertUser({ name, email:name + '@qa.test', cpf:null, passwordHash }, role, 'active')
    if (membership) await setMembership(id, 1, membership)
  }
  api = app.listen(0, '127.0.0.1')
  await new Promise(resolve => api.once('listening', resolve))
  vite = await createServer({
    mode:'test', root:fileURLToPath(new URL('../..', import.meta.url)),
    server:{ host:'127.0.0.1', port:5192, strictPort:true, proxy:{ '/api':'http://127.0.0.1:' + api.address().port } },
  })
  await vite.listen()
  browser = await chromium.launch({ headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
  const errors = []
  for (const [name, width, height] of [['admin', 1440, 900], ['gerente', 768, 1024], ['usuario', 390, 844]]) {
    env.SERVICE_LOCK_ENABLED = true
    const title = name === 'admin' ? adminTitle : generalTitle
    const context = await browser.newContext({ viewport:{ width, height }, reducedMotion:'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', entry => {
      if (['error', 'warning'].includes(entry.type()) && !/status of (401|423)/.test(entry.text())) errors.push(entry.text())
    })
    await page.clock.install({ time:new Date('2026-11-16T12:00:00-03:00') })
    await page.goto(url + '/bloqueio')
    await page.getByRole('heading', { name:'Entrar', exact:true }).waitFor()
    assert.equal(page.url(), url + '/login')
    const businessRequests = []
    page.on('request', req => {
      const path = new URL(req.url()).pathname
      if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) businessRequests.push(path)
    })
    await login(page, name)
    const heading = page.getByRole('heading', { name:title, exact:true })
    await heading.waitFor()
    await page.waitForURL(url + '/bloqueio')
    assert.match(await page.title(), /PayTrack/)
    assert.equal(await page.getByRole('button').count(), 1)
    assert.equal(await page.getByRole('link').count(), 0)
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.locator('vite-error-overlay').count(), 0)
    if (name !== 'admin') assert.doesNotMatch(await page.locator('body').innerText(), /pagamento|cobrança|financeir/i)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const card = await page.getByRole('region', { name:title }).boundingBox()
    assert.ok(Math.abs(card.x + card.width / 2 - width / 2) < 2)
    assert.ok(Math.abs(card.y + card.height / 2 - height / 2) < 2)
    if (process.env.E2E_ARTIFACT_DIR)
      await page.screenshot({ path:join(process.env.E2E_ARTIFACT_DIR, 'bloqueio-' + name + '.png') })
    for (const path of ['/reports', '/users', '/change-required-password', '/login']) {
      await page.goto(url + path)
      await heading.waitFor()
      await page.waitForURL(url + '/bloqueio')
    }
    assert.deepEqual(businessRequests, [])
    const dashboard = page.getByRole('heading', { name:'Recebimentos', exact:true })
    const notice = page.getByRole('dialog', { name:'Atenção', exact:true })
    if (name === 'admin') {
      // An already open session follows both changes through the status poll.
      env.SERVICE_LOCK_ENABLED = false
      await page.clock.fastForward(31000)
      await dashboard.waitFor()
      assert.equal(await notice.count(), 0)
      assert.equal(page.url(), url + '/')
      env.SERVICE_LOCK_ENABLED = true
      await page.clock.fastForward(31000)
      await heading.waitFor()
      assert.equal(await notice.count(), 0)
      await page.waitForURL(url + '/bloqueio')
    } else if (name === 'usuario') {
      env.SERVICE_LOCK_ENABLED = false
      await page.goto(url + '/account')
      await page.locator('#account-email').fill('outro@qa.test')
      env.SERVICE_LOCK_ENABLED = true
      const denied = page.waitForResponse(res => res.url().endsWith('/auth/me') && res.request().method() === 'PATCH')
      await page.getByRole('button', { name:'Salvar alterações' }).click()
      assert.equal((await denied).status(), 423)
      await heading.waitFor()
      await page.waitForURL(url + '/bloqueio')
    }
    await page.getByRole('button', { name:'Sair da conta' }).click()
    await page.getByRole('heading', { name:'Entrar', exact:true }).waitFor()
    await page.goto(url + '/account')
    await page.getByRole('heading', { name:'Entrar', exact:true }).waitFor()

    env.SERVICE_LOCK_ENABLED = false
    await login(page, name)
    await dashboard.waitFor()
    assert.equal(page.url(), url + '/')
    assert.equal(await notice.count(), 0)
    const navigation = width < 1024
      ? page.getByRole('navigation', { name:'Navegação principal', exact:true })
      : page.locator('aside')
    await navigation.locator('a[href="/clients"]').click()
    const clients = page.getByRole('heading', { name:'Gestão de clientes', exact:true })
    await clients.waitFor()
    await page.reload()
    await clients.waitFor()
    assert.equal(page.url(), url + '/clients')
    assert.equal(await notice.count(), 0)
    assert.equal(await page.locator('vite-error-overlay').count(), 0)
    if (process.env.E2E_ARTIFACT_DIR)
      await page.screenshot({ path:join(process.env.E2E_ARTIFACT_DIR, 'acesso-' + name + '.png') })

    await page.goto(url + '/bloqueio')
    await dashboard.waitFor()
    assert.equal(page.url(), url + '/')
    await page.goto(url + '/users')
    if (name === 'usuario') {
      await dashboard.waitFor()
      assert.equal(page.url(), url + '/')
    } else {
      await page.getByRole('heading', { name:'Usuários e solicitações', exact:true }).waitFor()
      assert.equal(page.url(), url + '/users')
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
})
