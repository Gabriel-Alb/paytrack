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

test('modal: layout original, parciais, somente multa, quitação Sim/Não/Outro valor, estornos e mobile', { timeout: 120000 }, async t => {
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
  const client = await createClient({companyIds:[1], name: 'Cliente Pagamento', cpf: '52998224725' }, actor);
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
  const card = label => modal.getByText(label, { exact: true }).locator('..');
  const value = () => modal.getByLabel('Valor pago', { exact: true });
  const fineQuestion = () => modal.getByText(/^Multa de .* recebida\?/);
  const total = async expected => assert.match(await card('Total recebido').innerText(), expected);
  await open(plain.id);
  for (const label of ['Vencimento', 'Pago em', 'Valor da parcela', 'Dias de atraso', 'Multa diária', 'Multa acumulada', 'Total recebido'])
    assert.equal(await card(label).count() >= 1, true);
  for (const label of ['Pagamento registrado por', 'Destinado à multa', 'Destinado à parcela', 'Saldo da parcela após pagamento', 'Multa pendente após pagamento', 'Saldo restante da parcela', 'Total atualmente devido'])
    assert.equal(await modal.getByText(label, { exact: true }).count(), 0);
  for (const amount of ['0', '-1', '0.001', '111']) {
    await value().fill(amount);
    assert.equal(await modal.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), true);
  }
  await value().fill('90');
  assert.equal(await fineQuestion().count(), 0);
  await total(/0,00/);
  assert.match(await card('Parcelas pagas').innerText(), /0\/1/);
  await page.screenshot({ path: join(artifacts, 'partial-desktop.png'), animations: 'disabled' });
  let state = await confirm(plain.id);
  assert.equal(state.installments[0].paid_amount, 9000);
  assert.equal(state.installments[0].status, 'partial');
  assert.equal(state.installments[0].paid_at, null);
  await open(plain.id);
  await total(/90,00/);
  assert.match(await card('Pago em').innerText(), /Não informado/);
  await value().fill('10');
  state = await confirm(plain.id);
  assert.equal(state.installments[0].status, 'partial');
  await open(plain.id);
  await total(/100,00/);
  await value().fill('10');
  state = await confirm(plain.id);
  assert.equal(state.installments[0].status, 'paid');
  await open(plain.id);
  await total(/110,00/);
  await modal.getByRole('button', { name: 'Estornar pagamento', exact: true }).last().click();
  state = await confirm(plain.id);
  assert.equal(state.installments[0].paid_amount, 10000);
  assert.equal(state.installments[0].status, 'partial');

  await open(fee.id);
  await value().fill('10');
  await modal.getByLabel('Pagamento somente da multa').check();
  await value().fill('20.01');
  assert.equal(await modal.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), true);
  await value().fill('10');
  assert.equal(await fineQuestion().count(), 0);
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 0);
  assert.equal(state.installments[0].late_fee_paid_amount, 1000);
  assert.notEqual(state.installments[0].status, 'paid');
  await open(fee.id);
  await total(/10,00/);
  assert.match(await card('Multa acumulada').innerText(), /10,00/);
  await value().fill('10');
  await modal.getByLabel('Pagamento somente da multa').check();
  state = await confirm(fee.id);
  assert.equal(state.installments[0].late_fee_paid_amount, 2000);
  await open(fee.id);
  await total(/20,00/);
  assert.match(await card('Multa acumulada').innerText(), /0,00/);
  await value().fill('110');
  assert.equal(await fineQuestion().count(), 0);
  await value().fill('30');
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 3000);
  assert.equal(state.installments[0].late_fee_paid_amount, 2000);
  await open(fee.id);
  await total(/50,00/);
  assert.match(await modal.innerText(), /Recebimentos registrados/);
  assert.match(await modal.innerText(), /Pagamentos QA/);
  assert.match(await modal.innerText(), /Parcela: R\$\s*0,00 · Multa: R\$\s*10,00/);
  await modal.getByRole('button', { name: 'Cancelar lançamento' }).click();
  await modal.getByRole('button', { name: 'Estornar pagamento', exact: true }).first().click();
  state = await confirm(fee.id);
  assert.equal(state.installments[0].late_fee_paid_amount, 1000);
  assert.equal(state.installments[0].paid_amount, 3000);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(fee.id);
  await value().fill('50');
  assert.equal(await fineQuestion().count(), 0);
  await value().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(artifacts, 'partial-mobile.png'), animations: 'disabled' });
  assert.equal(await modal.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 8000);
  assert.equal(state.installments[0].late_fee_paid_amount, 1000);
  assert.equal(state.installments[0].status, 'partial');
  await open(fee.id);
  await value().fill('30');
  assert.match(await fineQuestion().innerText(), /10,00/);
  await modal.getByRole('button', { name: 'Sim', exact: true }).click();
  state = await confirm(fee.id);
  assert.equal(state.installments[0].paid_amount, 11000);
  assert.equal(state.installments[0].late_fee_paid_amount, 2000);

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [option, feeAmount] of [['Sim', 2000], ['Não', 0], ['Outro valor', 500]]) {
    const item = await create({ first_due_date: addDays(today(), -2) });
    await open(item.id);
    await value().fill('110');
    assert.match(await fineQuestion().innerText(), /20,00/);
    assert.equal(await modal.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), true);
    await modal.getByRole('button', { name: option, exact: true }).click();
    if (option === 'Outro valor') {
      for (const invalid of ['', '-1', '20.01', '0.001']) {
        await modal.getByLabel('Valor da multa recebido').fill(invalid);
        assert.equal(await modal.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), true);
      }
      await modal.getByLabel('Valor da multa recebido').fill('5');
      await page.screenshot({ path: join(artifacts, 'fee-question-desktop.png'), animations: 'disabled' });
    }
    await value().fill('90');
    assert.equal(await fineQuestion().count(), 0);
    await modal.getByLabel('Pagamento somente da multa').check();
    assert.equal(await fineQuestion().count(), 0);
    await modal.getByLabel('Pagamento somente da multa').uncheck();
    await value().fill('110');
    state = await confirm(item.id);
    assert.equal(state.installments[0].status, 'paid');
    assert.equal(state.installments[0].paid_amount, 11000);
    assert.equal(state.installments[0].late_fee_paid_amount, feeAmount);
    await open(item.id);
    await total(new RegExp(((11000 + feeAmount) / 100).toFixed(2).replace('.', ',')));
    assert.equal(await modal.getByRole('button', { name: 'Estornar pagamento', exact: true }).count(), 1);
    if (feeAmount < 2000) {
      assert.equal(await modal.getByLabel('Pagamento somente da multa').isChecked(), true);
      await modal.getByRole('button', { name: 'Cancelar lançamento' }).click();
    }
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  const full = await create();
  await open(full.id);
  await value().fill('110');
  assert.equal(await fineQuestion().count(), 0);
  state = await confirm(full.id);
  assert.equal(state.installments[0].status, 'paid');
  assert.equal(state.payments[0].amount, 11000);
  assert.equal(state.payments[0].late_fee_amount, 0);
  assert.equal(page.url(), url + '/loans?loan=' + full.id);
  assert.match(await page.title(), /PayTrack/i);
  assert.ok((await page.locator('body').innerText()).length > 100);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
});
