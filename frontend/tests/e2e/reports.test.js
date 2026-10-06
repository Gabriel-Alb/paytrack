import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'http://127.0.0.1:5184';

test('relatórios: indicadores, mês/empresa em todos os blocos, permissões e mobile', { timeout: 120000 }, async t => {
  await import('../../../backend/tests/setup-env.js');
  process.env.FRONTEND_ORIGIN = url;
  const { app } = await import('../../../backend/src/app.js');
  const { openDatabase, closeDatabase, database } = await import('../../../backend/src/config/database.js');
  const { createMaster, newSession } = await import('../../../backend/src/modules/auth/auth.service.js');
  const { insertUser } = await import('../../../backend/src/modules/auth/auth.repository.js');
  const { replaceUserCompanies } = await import('../../../backend/src/modules/companies/companies.repository.js');
  const { authConfig } = await import('../../../backend/src/config/auth.js');
  const { createClient } = await import('../../../backend/src/modules/clients/clients.service.js');
  const { createLoan } = await import('../../../backend/src/modules/loans/loans.service.js');
  const { registerPayment } = await import('../../../backend/src/modules/payments/payments.service.js');
  const { today, addDays } = await import('../../../backend/src/shared/utils/dates.js');
  let api, vite, browser;
  t.after(async () => {
    await browser?.close();
    await vite?.close();
    if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
    await closeDatabase();
  });
  await openDatabase(':memory:');
  await createMaster({ name: 'Relatórios QA', email: 'reports@qa.test', cpf: '12345678909', password: 'QaSenha123' });
  const actor = await database().prepare('SELECT * FROM users LIMIT 1').get();
  const client = await createClient({ companyIds: [1, 2], name: 'Cliente Relatório', cpf: '52998224725' }, actor);
  const currentStart = today().slice(0, 7) + '-01';
  // The selector preserves its existing current-year behavior, including in January.
  const otherMonth = Number(today().slice(5, 7)) === 1 ? 2 : Number(today().slice(5, 7)) - 1;
  const otherStart = today().slice(0, 4) + '-' + String(otherMonth).padStart(2, '0') + '-01';
  const create = (company_id, principal_amount, interest_percentage, loan_date = currentStart) => createLoan({
    company_id, client_id: client.id, principal_amount, interest_percentage, installment_count: 2,
    late_fee_per_day: 0, loan_date, first_due_date: addDays(loan_date, 1),
  }, actor);
  const first = await create(1, 10000, '10');
  await create(2, 20000, '20');
  await create(2, 15000, '0', otherStart);
  await registerPayment(first.installments[0].id, { revision: first.revision, amount: 3000, payment_date: today() }, actor);
  api = app.listen(33026, '127.0.0.1');
  await new Promise(resolve => api.once('listening', resolve));
  const { createServer } = await import('vite');
  vite = await createServer({ mode: 'test', root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { host: '127.0.0.1', port: 5184, strictPort: true, proxy: { '/api': 'http://127.0.0.1:33026' } } });
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && !/status of 401/.test(message.text())) errors.push(message.text());
  });
  const artifacts = process.env.E2E_ARTIFACT_DIR || mkdtempSync(join(tmpdir(), 'paytrack-reports-'));
  t.diagnostic('Capturas: ' + artifacts);
  await page.goto(url + '/login');
  await page.getByLabel('E-mail', { exact: true }).fill('reports@qa.test');
  await page.locator('#password').fill('QaSenha123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url + '/');
  await page.goto(url + '/reports');
  assert.equal(page.url(), url + '/reports');
  assert.match(await page.title(), /PayTrack/i);
  const row = page.getByRole('region', { name: 'Resumo mensal' });
  const labels = ['Capital emprestado', 'Juros', 'Multas recebidas', 'Valor recebido', 'Falta receber'];
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  async function check(values) {
    await page.waitForFunction(() => document.querySelector('.report-metrics')?.getAttribute('aria-busy') === 'false');
    for (let i = 0; i < labels.length; i++) {
      assert.equal(await row.getByRole('heading', { name: labels[i], exact: true }).locator('..').locator('p').innerText(), money(values[i]));
    }
  }
  await check([300, 50, 0, 30, 320]);
  assert.equal(await row.locator('article').count(), 7);
  assert.deepEqual((await row.locator('label, h2').allTextContents()).map(text => text.trim()), ['Mês analisado', 'Empresa', ...labels]);
  assert.equal(await row.getByLabel('Empresa', { exact: true }).inputValue(), '');
  assert.deepEqual(await row.locator('#report-company option').allTextContents(), ['Todas as empresas', 'Dinheiro Express', 'Platinum Finance']);
  await page.waitForFunction(() => document.querySelector('.monthly-report')?.getAttribute('aria-busy') === 'false');
  const lowerBlocks = () => page.locator('.report-dashboard > :not(.report-metrics-row)').allTextContents();
  const before = await lowerBlocks();
  const monthlyRequests = [];
  page.on('request', req => { if (req.url().includes('mode=month')) monthlyRequests.push(req.url()); });
  async function select(selector, value) {
    const response = page.waitForResponse(res => res.url().includes('mode=metrics') && res.status() === 200);
    const monthly = page.waitForResponse(res => res.url().includes('mode=month') && res.status() === 200);
    await row.locator(selector).selectOption(String(value));
    await Promise.all([response, monthly]);
    await page.waitForFunction(() => document.querySelector('.monthly-report')?.getAttribute('aria-busy') === 'false');
  }
  await select('#report-company', 1);
  await check([100, 10, 0, 30, 80]);
  await select('#report-company', 2);
  await check([200, 40, 0, 0, 240]);
  assert.notDeepEqual(await lowerBlocks(), before);
  assert.equal(monthlyRequests.length, 2);
  assert.ok(monthlyRequests[0].includes('company_id=1'));
  assert.ok(monthlyRequests[1].includes('company_id=2'));
  await page.screenshot({ path: join(artifacts, 'reports-desktop.png'), animations: 'disabled' });
  await select('#report-month', otherMonth);
  await check([150, 0, 0, 0, 150]);
  await select('#report-company', 1);
  await check([0, 0, 0, 0, 0]);
  await select('#report-company', '');
  await check([150, 0, 0, 0, 150]);
  await select('#report-month', Number(today().slice(5, 7)));
  await check([300, 50, 0, 30, 320]);
  await page.setViewportSize({ width: 390, height: 844 });
  await select('#report-company', 1);
  await check([100, 10, 0, 30, 80]);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(artifacts, 'reports-mobile.png'), animations: 'disabled' });
  const userId = await insertUser({ name: 'Usuário QA', email: 'limited@qa.test', cpf: null, passwordHash: 'offline-test' }, 'user', 'active');
  await replaceUserCompanies(userId, [1]);
  const session = await newSession(userId);
  await page.context().clearCookies();
  await page.context().addCookies([{ name: authConfig.cookieName, value: session.token, url }]);
  await page.goto(url + '/reports');
  await check([100, 10, 0, 30, 80]);
  await page.waitForFunction(() => !document.querySelector('#report-company')?.disabled);
  assert.deepEqual(await row.locator('#report-company option').allTextContents(), ['Todas as empresas', 'Dinheiro Express']);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
});
