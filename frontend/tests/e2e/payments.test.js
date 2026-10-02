import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'http://127.0.0.1:5183';

test('modal: parcial, somente multa, divisão, quitação, estorno, validação e mobile', { timeout: 120000 }, async t => {
  await import('../../../backend/tests/setup-env.js');
  process.env.FRONTEND_ORIGIN = url;
  const { app } = await import('../../../backend/src/app.js');
  const { openDatabase, closeDatabase, database } = await import('../../../backend/src/config/database.js');
  const { createMaster } = await import('../../../backend/src/modules/auth/auth.service.js');
  const { createClient } = await import('../../../backend/src/modules/clients/clients.service.js');
  const { createLoan, getLoan } = await import('../../../backend/src/modules/loans/loans.service.js');
  const { today, addDays } = await import('../../../backend/src/shared/utils/dates.js');
  let api, vite, browser;
  t.after(async () => {
    await browser?.close();
    await vite?.close();
    if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
    await closeDatabase();
  });
  await openDatabase(':memory:');
  await createMaster({ name: 'Pagamentos QA', email: 'payments@qa.test', cpf: '12345678909', password: 'QaSenha123' });
  const actor = await database().prepare('SELECT * FROM users LIMIT 1').get();
  const client = await createClient({ name: 'Cliente Pagamento', cpf: '52998224725' }, actor);
  const create = (overrides = {}) => createLoan({ company_id: 1, client_id: client.id, principal_amount: 10000,
    interest_percentage: '10', installment_count: 1, late_fee_per_day: 1000,
    loan_date: addDays(today(), -10), first_due_date: today(), ...overrides }, actor);
  const plain = await create();
  const fee = await create({ first_due_date: addDays(today(), -2) });
  api = app.listen(33025, '127.0.0.1');
  await new Promise(resolve => api.once('listening', resolve));
  const { createServer } = await import('vite');
  vite = await createServer({ mode: 'test', root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { host: '127.0.0.1', port: 5183, strictPort: true, proxy: { '/api': 'http://127.0.0.1:33025' } } });
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && !/status of 401/.test(message.text())) errors.push(message.text());
  });
  const artifacts = process.env.E2E_ARTIFACT_DIR || mkdtempSync(join(tmpdir(), 'paytrack-payments-'));
  t.diagnostic('Capturas: ' + artifacts);
  await page.goto(url + '/login');
  await page.getByLabel('E-mail', { exact: true }).fill('payments@qa.test');
  await page.locator('#password').fill('QaSenha123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url + '/');
  const modal = page.getByRole('dialog');
  async function open(id) {
    await page.goto(url + '/loans?loan=' + id);
    await modal.getByRole('heading', { name: 'Parcelas do contrato', level: 2 }).waitFor();
    await modal.getByRole('button', { name: 'Registrar pagamento da parcela 1', exact: true }).click();
  }
  async function confirm(id) {
    const saved = page.waitForResponse(response => response.url().endsWith('/loans/' + id + '/payment-confirmation') && response.request().method() === 'PUT');
    await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
    assert.equal((await saved).status(), 200);
    await modal.waitFor({ state: 'hidden' });
    return getLoan(id);
  }
  const preview = label => modal.getByText(label, { exact: true }).locator('..');
  await open(plain.id);
  for (const amount of ['0', '-1', '0.001', '111']) {
    await modal.getByLabel('Valor recebido', { exact: true }).fill(amount);
    assert.equal(await modal.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), true);
  }
  await modal.getByLabel('Valor recebido', { exact: true }).fill('90');
  assert.match(await preview('Saldo da parcela após pagamento').innerText(), /20,00/);
  assert.match(await modal.innerText(), /A parcela continuará em aberto/);
  assert.match(await preview('Parcelas pagas').innerText(), /0\/1/);
  await page.screenshot({ path: join(artifacts, 'partial-desktop.png'), animations: 'disabled' });
  let state = await confirm(plain.id);
  assert.equal(state.installments[0].paid_amount, 9000);
  assert.equal(state.installments[0].status, 'partial');
  await open(plain.id);
  assert.match(await preview('Saldo restante da parcela').innerText(), /20,00/);
  await modal.getByLabel('Valor recebido', { exact: true }).fill('20');
  assert.match(await modal.innerText(), /A parcela será quitada/);
  state = await confirm(plain.id);
  assert.equal(state.installments[0].status, 'paid');
  await open(plain.id);
  await modal.getByRole('button', { name: 'Estornar pagamento', exact: true }).last().click();
  state = await confirm(plain.id);
  assert.equal(state.installments[0].paid_amount, 9000);
  assert.equal(state.installments[0].status, 'partial');

  await open(fee.id);
  await modal.getByLabel('Valor recebido', { exact: true }).fill('20');
  await modal.getByLabel('Pagamento somente da multa').check();
  assert.match(await preview('Saldo da parcela após pagamento').innerText(), /110,00/);
  assert.match(await preview('Multa pendente após pagamento').innerText(), /0,00/);
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 0);
  assert.equal(state.installments[0].late_fee_paid_amount, 2000);
  await open(fee.id);
  assert.match(await preview('Multa pendente').innerText(), /0,00/);
  await modal.getByLabel('Valor recebido', { exact: true }).fill('30');
  assert.match(await preview('Destinado à multa').innerText(), /0,00/);
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 3000);
  await open(fee.id);
  await modal.getByRole('button', { name: 'Cancelar lançamento' }).click();
  await modal.getByRole('button', { name: 'Estornar pagamento', exact: true }).first().click();
  state = await confirm(fee.id);
  assert.equal(state.installments[0].late_fee_paid_amount, 0);
  assert.equal(state.installments[0].paid_amount, 3000);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(fee.id);
  await modal.getByLabel('Valor recebido', { exact: true }).fill('50');
  assert.match(await preview('Destinado à multa').innerText(), /20,00/);
  assert.match(await preview('Destinado à parcela').innerText(), /30,00/);
  assert.match(await preview('Saldo da parcela após pagamento').innerText(), /50,00/);
  await preview('Saldo da parcela após pagamento').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(artifacts, 'mixed-mobile.png'), animations: 'disabled' });
  assert.equal(await modal.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 6000);
  assert.equal(state.installments[0].late_fee_paid_amount, 2000);
  assert.equal(state.installments[0].status, 'partial');
  assert.equal(page.url(), url + '/loans?loan=' + fee.id);
  assert.match(await page.title(), /PayTrack/i);
  assert.ok((await page.locator('body').innerText()).length > 100);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
});
