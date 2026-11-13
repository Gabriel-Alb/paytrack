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
const message = 'A data de vencimento estabelecida para o pagamento é 13/11/2026. Caso o pagamento permaneça pendente após essa data, o acesso ao sistema poderá ser temporariamente suspenso até a regularização.'
const repeatMs = 120000

test('aviso de cobrança: navegação, autenticação, repetição e controle manual', { timeout: 240000 }, async t => {
  let vite, browser
  t.after(async () => {
    await browser?.close()
    await vite?.close()
  })
  async function startVite({ disabled = false } = {}) {
    vite = await createServer({ mode: 'test', root: fileURLToPath(new URL('../..', import.meta.url)),
      server: { host: '127.0.0.1', port: 5188, strictPort: true },
      // Exercise the existing manual switch without changing the source file on disk.
      plugins: disabled ? [{
        name: 'disable-payment-notice-for-test',
        enforce: 'pre',
        transform(source, id) {
          if (id.replaceAll('\\', '/').endsWith('/PaymentNoticeModal.vue')) {
            assert.match(source, /const PAYMENT_NOTICE_ENABLED = true/)
            return source.replace('const PAYMENT_NOTICE_ENABLED = true', 'const PAYMENT_NOTICE_ENABLED = false')
          }
        },
      }] : [],
    })
    await vite.listen()
  }
  await startVite()
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) })
  const artifacts = process.env.E2E_ARTIFACT_DIR || mkdtempSync(join(tmpdir(), 'paytrack-payment-notice-'))
  t.diagnostic('Capturas: ' + artifacts)
  const errors = []

  async function open({
    role = 'admin', managedCompanyIds = [], authenticated = Boolean(role),
    date = '2026-11-13T12:00:00-03:00', width = 1440,
    blockedStorage = false, previousNoticeShown = false, controlledClock = false,
  } = {}) {
    // A different browser timezone verifies that the application's dates use São Paulo.
    const context = await browser.newContext({
      viewport: { width, height: 900 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', entry => {
      if (['error', 'warning'].includes(entry.type()) && !/status of 401/.test(entry.text())) errors.push(entry.text())
    })
    if (controlledClock) await page.clock.install({ time: new Date(date) })
    else await page.clock.setFixedTime(new Date(date))
    if (previousNoticeShown) await page.addInitScript(() => {
      for (const month of ['2026-10', '2026-11']) sessionStorage.setItem('paytrack:payment-notice:' + month, 'shown')
    })
    if (blockedStorage) await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } })
    })
    const session = { authenticated }
    const user = { id: 1, name: 'Pessoa QA', email: 'qa@example.test', role: role || 'admin', managedCompanyIds, companyIds: [1] }
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/csrf') return route.fulfill({ json: { csrfToken: 'qa-csrf' } })
      if (path === '/api/auth/login') {
        session.authenticated = true
        return route.fulfill({ json: { user, csrfToken: 'qa-csrf' } })
      }
      if (path === '/api/auth/logout') {
        session.authenticated = false
        return route.fulfill({ json: { ok: true } })
      }
      if (path === '/api/auth/me') return route.fulfill(session.authenticated
        ? { json: { user } } : { status: 401, json: { error: { code: 'UNAUTHENTICATED' } } })
      if (path === '/api/clients') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/dashboard/summary') return route.fulfill({ json: {} })
      return route.fulfill({ json: [] })
    })
    await page.goto(url + '/account')
    await page.getByRole('heading', { name: authenticated ? 'Dados pessoais' : 'Entrar', exact: true }).waitFor()
    // Pause after the initial render, before exercising the timer without real waiting.
    if (controlledClock) await page.clock.pauseAt(new Date(new Date(date).getTime() + 60000))
    return { page, context, session, controlledClock, dialog: page.getByRole('dialog', { name: 'Atenção', exact: true }) }
  }

  async function closeNotice({ page, dialog, controlledClock }) {
    const button = dialog.getByRole('button', { name: 'Fechar', exact: true })
    // Keyboard activation avoids waiting for hover animation frames with a paused clock.
    if (controlledClock) await button.press('Enter')
    else await button.click()
    const closedAt = await page.evaluate(() => Date.now())
    if (controlledClock) await page.clock.runFor(50)
    await dialog.waitFor({ state: 'hidden' })
    return closedAt
  }
  async function advanceTo(page, time) {
    await page.clock.runFor(time - await page.evaluate(() => Date.now()))
  }
  async function navigateToClients(page, controlledClock = false) {
    const navigation = page.viewportSize().width < 1024
      ? page.getByRole('navigation', { name: 'Navegação principal', exact: true })
      : page.locator('aside')
    const link = navigation.locator('a[href="/clients"]')
    if (controlledClock) await link.press('Enter')
    else await link.click()
    await page.getByRole('heading', { name: 'Gestão de clientes', exact: true }).waitFor()
  }
  async function login({ page }) {
    await page.getByLabel('E-mail', { exact: true }).fill('qa@example.test')
    await page.locator('#password').fill('QaSenha123')
    await page.locator('#password').press('Enter')
    await page.waitForURL(url + '/')
  }

  await t.test('início em 12/11 e ausência de encerramento automático', async () => {
    for (const [date, visible] of [
      ['2026-11-11T23:59:59-03:00', false],
      ['2026-11-12T00:00:00-03:00', true],
      ['2026-11-14T00:00:00-03:00', true],
      ['2026-11-16T00:00:00-03:00', true],
      ['2036-11-12T00:00:00-03:00', true],
    ]) {
      const fixture = await open({ date })
      assert.equal(await fixture.dialog.count(), Number(visible), date)
      await fixture.context.close()
    }
  })

  await t.test('permissões preservadas, inclusive depois do início da repetição', async () => {
    for (const options of [{ role: 'user', managedCompanyIds: [1] }, { role: 'user' }, { role: 'manager' }, { role: null }]) {
      const fixture = await open({ ...options, date: '2026-11-14T12:00:00-03:00', controlledClock: true })
      await fixture.page.clock.fastForward(10 * repeatMs)
      assert.equal(await fixture.dialog.count(), 0)
      await fixture.context.close()
    }
  })

  await t.test('mensagem exata, layout, fechamento, reload e navegação SPA no desktop e mobile', async () => {
    for (const width of [1440, 390]) {
      const fixture = await open({ width, previousNoticeShown: true })
      const { page, context, dialog } = fixture
      await dialog.waitFor()
      assert.equal(page.url(), url + '/account')
      assert.match(await page.title(), /PayTrack/i)
      assert.equal(await dialog.locator('p').first().innerText(), message)
      assert.equal(await dialog.locator('footer').innerText(), 'Mensagem automática do sistema')
      assert.equal(await dialog.getByRole('button').count(), 1)
      assert.equal(await dialog.locator('.touch-none').count(), 0, 'Sem controle de arraste')
      await page.screenshot({ path: join(artifacts, width === 1440 ? 'notice-updated-desktop.png' : 'notice-updated-mobile.png'), animations: 'disabled' })
      const bounds = await dialog.boundingBox()
      assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2)
      assert.ok(Math.abs(bounds.y + bounds.height / 2 - 450) < 2)
      assert.ok(bounds.width <= 440 && bounds.x >= 16)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.keyboard.press('Escape')
      assert.equal(await dialog.isVisible(), true)
      await page.mouse.click(4, 4)
      assert.equal(await dialog.isVisible(), true)
      await closeNotice(fixture)
      await page.locator('#account-email').fill('editavel@example.test')
      assert.equal(await page.locator('#account-email').inputValue(), 'editavel@example.test')
      await page.reload()
      await dialog.waitFor()
      await closeNotice(fixture)
      await navigateToClients(page)
      await dialog.waitFor()
      assert.equal(await dialog.count(), 1)
      await closeNotice(fixture)
      await page.goBack()
      await dialog.waitFor()
      assert.equal(page.url(), url + '/account')
      assert.equal(await page.locator('vite-error-overlay').count(), 0)
      await context.close()
    }
    const fixture = await open({ blockedStorage: true })
    await fixture.dialog.waitFor()
    await closeNotice(fixture)
    await navigateToClients(fixture.page)
    await fixture.dialog.waitFor()
    await fixture.context.close()
  })

  await t.test('até 13/11, permanecer na página não reapresenta o aviso', async () => {
    const fixture = await open({ controlledClock: true })
    await closeNotice(fixture)
    await fixture.page.clock.fastForward(10 * repeatMs)
    assert.equal(await fixture.dialog.count(), 0)
    await fixture.context.close()
  })

  await t.test('a partir de 14/11, dois minutos após fechar, sem interação e sem duplicar o modal', async () => {
    for (const width of [1440, 390]) {
      const fixture = await open({ width, date: '2026-11-14T12:00:00-03:00', controlledClock: true })
      const { page, dialog } = fixture
      let closedAt = await closeNotice(fixture)
      await advanceTo(page, closedAt + repeatMs - 1)
      assert.equal(await dialog.count(), 0)
      await page.clock.runFor(1)
      await dialog.waitFor()
      await page.clock.fastForward(10 * repeatMs)
      assert.equal(await dialog.count(), 1, 'Manter aberto não cria outros modais')
      closedAt = await closeNotice(fixture)
      await advanceTo(page, closedAt + 60000)
      await page.mouse.move(20, 20)
      await page.locator('#account-email').fill('interacao@example.test')
      await page.keyboard.press('Tab')
      await advanceTo(page, closedAt + repeatMs - 1)
      assert.equal(await dialog.count(), 0)
      await page.clock.runFor(1)
      await dialog.waitFor()
      assert.equal(await dialog.count(), 1)
      await fixture.context.close()
    }
  })

  await t.test('navegação mostra imediatamente e cancela a contagem anterior', async () => {
    const fixture = await open({ date: '2026-11-14T12:00:00-03:00', controlledClock: true })
    const { page, dialog } = fixture
    const firstClose = await closeNotice(fixture)
    await advanceTo(page, firstClose + 60000)
    await navigateToClients(page, true)
    await dialog.waitFor()
    const secondClose = await closeNotice(fixture)
    await advanceTo(page, firstClose + repeatMs)
    assert.equal(await dialog.count(), 0, 'O temporizador da página anterior foi cancelado')
    await advanceTo(page, secondClose + repeatMs - 1)
    assert.equal(await dialog.count(), 0)
    await page.clock.runFor(1)
    await dialog.waitFor()
    assert.equal(await dialog.count(), 1)
    await fixture.context.close()
  })

  await t.test('página aberta na virada para 14/11 inicia a repetição no horário de São Paulo', async () => {
    const fixture = await open({ date: '2026-11-13T23:58:00-03:00', controlledClock: true })
    const { page, dialog } = fixture
    await closeNotice(fixture)
    const midnight = new Date('2026-11-14T00:00:00-03:00').getTime()
    await advanceTo(page, midnight - 1)
    assert.equal(await dialog.count(), 0, 'Sem repetição antes de 14/11')
    await advanceTo(page, midnight + repeatMs - 1)
    assert.equal(await dialog.count(), 0)
    await page.clock.runFor(1)
    await dialog.waitFor()
    await fixture.context.close()
  })

  await t.test('login, logout e nova autenticação preservam exibição e limpeza da contagem', async () => {
    const fixture = await open({ authenticated: false, date: '2026-11-14T12:00:00-03:00', controlledClock: true })
    const { page, dialog, session } = fixture
    await login(fixture)
    await dialog.waitFor()
    await closeNotice(fixture)
    await page.getByRole('button', { name: /Pessoa QA/ }).press('Enter')
    await page.getByRole('button', { name: 'Sair', exact: true }).press('Enter')
    await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor()
    await page.clock.fastForward(10 * repeatMs)
    assert.equal(await dialog.count(), 0, 'Nenhum aviso na tela pública após logout')
    await login(fixture)
    await dialog.waitFor()
    const closedAt = await closeNotice(fixture)
    await advanceTo(page, closedAt + repeatMs - 1)
    assert.equal(await dialog.count(), 0)
    await page.clock.runFor(1)
    await dialog.waitFor()
    await closeNotice(fixture)
    session.authenticated = false
    await page.locator('a[href="/clients"]:visible').first().press('Enter')
    await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor()
    await page.clock.fastForward(10 * repeatMs)
    assert.equal(await dialog.count(), 0)
    await login(fixture)
    await dialog.waitFor()
    assert.equal(await dialog.count(), 1, 'Reautenticar após expiração restaura o aviso')
    await fixture.context.close()
  })

  await vite.close()
  await startVite({ disabled: true })
  await t.test('desativado: nenhum aviso no acesso, navegação, reload, login ou após dois minutos', async () => {
    for (const role of ['admin', 'user', 'manager', null]) {
      const fixture = await open({ role, date: '2026-11-14T12:00:00-03:00', controlledClock: true })
      const { page, dialog } = fixture
      await page.clock.fastForward(10 * repeatMs)
      assert.equal(await dialog.count(), 0)
      if (role) {
        await navigateToClients(page, true)
        assert.equal(await dialog.count(), 0)
        await page.reload()
        await page.getByRole('heading', { name: 'Gestão de clientes', exact: true }).waitFor()
      } else {
        await login(fixture)
        await page.getByRole('heading', { name: 'Recebimentos', exact: true }).waitFor()
      }
      await page.clock.fastForward(10 * repeatMs)
      assert.equal(await dialog.count(), 0)
      assert.equal(await page.evaluate(() => sessionStorage.length + localStorage.length), 0)
      await fixture.context.close()
    }
  })
  await vite.close()
  await startVite()
  await t.test('reativar restaura o aviso e a repetição', async () => {
    const fixture = await open({ date: '2026-11-14T12:00:00-03:00', controlledClock: true })
    await fixture.dialog.waitFor()
    const closedAt = await closeNotice(fixture)
    await advanceTo(fixture.page, closedAt + repeatMs)
    await fixture.dialog.waitFor()
    await fixture.context.close()
  })
  assert.deepEqual(errors, [])
})
