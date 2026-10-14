import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = 'http://127.0.0.1:5188'
const sessionKey = 'paytrack:payment-notice:2026-10'
const message = 'Solicitamos a regularização do pagamento conforme combinado, com prazo até 20/10/2026. Após essa data, o sistema poderá ser temporariamente desativado até a regularização do pagamento.'

test('aviso temporário: administrador global, período, sessão e fechamento exclusivo pelo X', { timeout: 120000 }, async t => {
  let vite, browser
  t.after(async () => {
    await browser?.close()
    await vite?.close()
  })
  vite = await createServer({ mode: 'test', root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { host: '127.0.0.1', port: 5188, strictPort: true } })
  await vite.listen()
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) })
  const artifacts = process.env.E2E_ARTIFACT_DIR || mkdtempSync(join(tmpdir(), 'paytrack-payment-notice-'))
  t.diagnostic('Capturas: ' + artifacts)
  const errors = []
  async function open({ role = 'admin', managedCompanyIds = [], date = '2026-10-20T12:00:00-03:00', width = 1440, blockedStorage = false } = {}) {
    // Use a different browser timezone to verify the application's São Paulo dates.
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Tokyo' })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', entry => {
      if (['error', 'warning'].includes(entry.type()) && !/status of 401/.test(entry.text())) errors.push(entry.text())
    })
    await page.clock.setFixedTime(new Date(date))
    if (blockedStorage) await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } })
    })
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/me') return route.fulfill(role ? { json: { user: {
        id: 1, name: 'Pessoa QA', email: 'qa@example.test', role, managedCompanyIds, companyIds: [1],
      } } } : { status: 401, json: { error: { code: 'UNAUTHENTICATED' } } })
      if (path === '/api/notifications') return route.fulfill({ json: [] })
      if (path === '/api/clients') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/companies') return route.fulfill({ json: [] })
      return route.fulfill({ json: [] })
    })
    await page.goto(url + '/account')
    await page.getByRole('heading', { name: role ? 'Dados pessoais' : 'Entrar', exact: true }).waitFor()
    return { page, context, dialog: page.getByRole('dialog', { name: 'Atenção', exact: true }) }
  }

  for (const [date, visible] of [
    ['2026-10-12T23:59:59-03:00', false],
    ['2026-10-13T00:00:00-03:00', true],
    ['2026-10-30T23:59:59-03:00', true],
    ['2026-10-31T00:00:00-03:00', false],
  ]) {
    const { page, context, dialog } = await open({ date })
    assert.equal(await dialog.count(), Number(visible), date)
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), sessionKey), visible ? 'shown' : null)
    if (visible) {
      await page.reload()
      await page.getByRole('heading', { name: 'Dados pessoais', exact: true }).waitFor()
      assert.equal(await dialog.count(), 0, 'Recarregar mesmo sem fechar não repete o aviso')
    }
    await context.close()
  }
  for (const options of [
    { role: 'user', managedCompanyIds: [1] },
    { role: 'user' },
    { role: 'manager' },
    { role: null },
    { blockedStorage: true },
  ]) {
    const { context, dialog } = await open(options)
    assert.equal(await dialog.count(), 0)
    await context.close()
  }

  for (const width of [1440, 390]) {
    const { page, context, dialog } = await open({ width })
    await dialog.waitFor()
    assert.equal(page.url(), url + '/account')
    assert.match(await page.title(), /PayTrack/i)
    assert.equal(await dialog.locator('p').first().innerText(), message)
    assert.equal(await dialog.locator('footer').innerText(), 'Mensagem automática do sistema')
    assert.equal(await dialog.getByRole('button').count(), 1)
    assert.equal(await dialog.locator('.touch-none').count(), 0, 'Sem controle de arraste')
    await page.screenshot({ path: join(artifacts, width === 1440 ? 'notice-desktop.png' : 'notice-mobile.png'), animations: 'disabled' })
    const bounds = await dialog.boundingBox()
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2)
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - 450) < 2)
    assert.ok(bounds.width <= 440 && bounds.x >= 16)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(), true)
    await page.mouse.click(4, 4)
    assert.equal(await dialog.isVisible(), true)
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.reload()
    await page.getByRole('heading', { name: 'Dados pessoais', exact: true }).waitFor()
    assert.equal(await dialog.count(), 0)
    await page.goto(url + '/clients')
    await page.getByRole('heading', { name: 'Gestão de clientes', exact: true }).waitFor()
    assert.equal(await dialog.count(), 0)
    assert.equal(await page.locator('vite-error-overlay').count(), 0)
    await context.close()
  }
  assert.deepEqual(errors, [])
})
