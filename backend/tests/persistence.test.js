import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, closeDatabase, database } from './database-helper.js';
import { unitOfWork } from '../src/application/persistence.js';
import { withCompanyAccess } from '../src/application/company-access.js';
import { checkSchema } from '../src/infrastructure/persistence/check.js';
import { proportionalAmount } from '../src/shared/utils/money.js';
import { insertUser } from '../src/modules/auth/auth.repository.js';
import { createClient } from '../src/modules/clients/clients.service.js';
import { createLoan } from '../src/modules/loans/loans.service.js';
import { registerPayment } from '../src/modules/payments/payments.service.js';
import { today } from '../src/shared/utils/dates.js';
import { listClients } from '../src/modules/clients/clients.service.js';
import { clientListSchema } from '../src/modules/clients/clients.validator.js';
import { report } from '../src/modules/overview/overview.service.js';
import { reportSchema } from '../src/modules/overview/overview.validator.js';

beforeEach(() => openDatabase());
afterEach(closeDatabase);
test('schema, chaves estrangeiras, índices e invariantes persistidos estão válidos', async () => {
  const db = database();
  const result = await checkSchema(db);
  assert.equal(result.tables, 12);
  await assert.rejects(db.prepare("INSERT INTO clients(company_id,name,cpf) VALUES(999,'Teste','123')").run());
  await assert.rejects(db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES('Teste','x@example.test','hash','master')").run());
  await assert.rejects(db.prepare("INSERT INTO auth_audit_logs(event,details,created_at) VALUES('test','invalid json',1)").run());
  const user = await insertUser({ name:'Administrador',email:'admin@example.test',cpf:null,passwordHash:'test' }, 'admin','active');
  await assert.rejects(db.prepare('DELETE FROM users WHERE id=?').run(user));
  await assert.rejects(db.prepare("UPDATE users SET access_status='blocked' WHERE id=?").run(user));
  await assert.rejects(db.prepare('INSERT INTO user_companies(user_id,company_id) VALUES(?,999)').run(user));
});
test('inteiros grandes, rateio exato, leap day, datas e parâmetros preservam os contratos', async () => {
  const db = database();
  for (const [amount,numerator,denominator] of [[100000000000,99999999999,100000000000],[1,1,3],[2,1,3],[0,5,7]]) {
    assert.equal((await db.prepare('SELECT money_share(?,?,?) AS amount').get(amount,numerator,denominator)).amount,
      proportionalAmount(amount,numerator,denominator));
  }
  assert.equal((await db.prepare("SELECT day_number('2024-03-01')-day_number('2024-02-28') AS days").get()).days, 2);
  const row = await db.prepare("SELECT '@ignored ?' AS literal, @value AS value, @empty AS empty /* @ignore ? */ -- @ignore ?\n")
    .get({ value:"O'Brien @name ?",empty:null });
  assert.deepEqual(row,{ literal:'@ignored ?',value:"O'Brien @name ?",empty:null });
  const timestamp = (await db.prepare('SELECT utc_now() AS value').get()).value;
  assert.match(timestamp,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});
test('savepoints aguardam callbacks assíncronos e rollback não descarta outra operação', async () => {
  const db = database();
  const write = name => db.prepare('INSERT INTO companies(name) VALUES(?)').run(name);
  await unitOfWork(async () => {
    await write('Persistida');
    await assert.rejects(unitOfWork(async () => { await write('Revertida'); throw new Error('nested'); }));
    await write('Também persistida');
  });
  const failing = unitOfWork(async () => {
    await write('Não persistir');
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('outer');
  });
  const outside = write('Operação independente');
  await assert.rejects(failing);
  await outside;
  await unitOfWork(() => write('Leitura revertida'), { rollback:true });
  const names = (await db.prepare('SELECT name FROM companies').all()).map(row => row.name);
  for (const name of ['Persistida','Também persistida','Operação independente']) assert.ok(names.includes(name));
  for (const name of ['Revertida','Não persistir','Leitura revertida']) assert.ok(!names.includes(name));
});
test('duas confirmações simultâneas mantêm revisão, saldo e um único recebimento', async () => {
  const client = await createClient({ name:'Concorrência',cpf:'52998224725' });
  const loan = await createLoan({ company_id:1,client_id:client.id,principal_amount:100000000000,
    interest_percentage:'0',installment_count:1,late_fee_per_day:0,loan_date:today(),first_due_date:today() });
  const data = { amount:100000000000,payment_date:today(),revision:loan.revision };
  const results = await Promise.allSettled([registerPayment(loan.installments[0].id,data),registerPayment(loan.installments[0].id,data)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code,'STALE_LOAN');
  const saved = await database().prepare('SELECT count(*) AS count, sum(amount) AS amount FROM payments').get();
  assert.deepEqual(saved,{count:1,amount:100000000000});
});
test('contextos simultâneos filtram leituras e escritas, sem herdar acesso de conexão reutilizada', async () => {
  const db = database();
  const client = await createClient({name:'Global',cpf:'52998224725'});
  for (const company_id of [1,2]) await createLoan({company_id,client_id:client.id,principal_amount:100,interest_percentage:'0',installment_count:1,late_fee_per_day:0,loan_date:today(),first_due_date:today()});
  await Promise.all([1,2,1,2,1,2].map(company => withCompanyAccess({role:'user',companyIds:[company]}, async () => {
    const rows = await db.prepare('SELECT company_id FROM scoped_loans').all();
    assert.deepEqual(rows,[{company_id:company}]);
    await assert.rejects(db.prepare('UPDATE loans SET notes=? WHERE company_id=?').run('Invasão',company===1?2:1));
  })));
  await withCompanyAccess({role:'user',companyIds:[]}, async () => {
    assert.deepEqual(await db.prepare('SELECT * FROM scoped_loans').all(),[]);
  });
  assert.equal((await db.prepare('SELECT count(*) AS n FROM scoped_loans').get()).n,2);
});
test('busca com barra e exclamação, comparação NOCASE e ordenação de nulos são compatíveis', async () => {
  const first = await createClient({name:'Teste \\ especial!',cpf:'52998224725'});
  const second = await createClient({name:'Outro teste',cpf:'11144477735'});
  assert.equal((await listClients(clientListSchema.parse({search:'\\ especial!'}))).total,1);
  assert.equal((await listClients(clientListSchema.parse({search:'TESTE'}))).total,2);
  const db = database();
  await db.prepare('INSERT INTO companies(name) VALUES(?)').run('Équipe');
  await db.prepare('INSERT INTO companies(name) VALUES(?)').run('équipe');
  const paid = await createLoan({company_id:1,client_id:first.id,principal_amount:100,interest_percentage:'0',
    installment_count:1,late_fee_per_day:0,loan_date:today(),first_due_date:today()});
  await registerPayment(paid.installments[0].id,{amount:100,payment_date:today(),revision:paid.revision});
  await createLoan({company_id:1,client_id:second.id,principal_amount:100,interest_percentage:'0',
    installment_count:1,late_fee_per_day:0,loan_date:today(),first_due_date:today()});
  const query = {start:today(),end:today(),sort:'paymentDate'};
  assert.equal((await report(reportSchema.parse({...query,direction:'asc'}))).items[0].paymentDate,null);
  assert.equal((await report(reportSchema.parse({...query,direction:'desc'}))).items[0].paymentDate,today());
});
