import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { configurePersistence } from '../src/application/persistence.js';
import { safeUser } from '../src/modules/auth/auth.service.js';
import { distributeInstallments } from '../src/modules/loans/loans.service.js';

test('serviços e contratos não importam drivers ou repositories concretos nem executam SQL', () => {
  const modules = new URL('../src/modules/',import.meta.url);
  for (const name of readdirSync(modules)) {
    for (const file of readdirSync(new URL(`${name}/`,modules)).filter(file => /\.(service|repository)\.js$/.test(file))) {
      const source = readFileSync(new URL(`${name}/${file}`,modules),'utf8');
      assert.doesNotMatch(source,/config\/database|infrastructure\/|better-sqlite3|from ['"]pg['"]|\.prepare\(|\.pragma\(/,file);
    }
  }
});
test('aplicação funciona com implementação de repository injetada e cálculos não exigem banco', async () => {
  const requested = [];
  configurePersistence({companies:{userCompanies:async id => { requested.push(id); return [{id:2,name:'Empresa'}]; }}});
  try {
    const user = await safeUser({id:9,name:'Usuário',email:'user@example.test',role:'user',access_status:'active'});
    assert.deepEqual(requested,[9]); assert.deepEqual(user.companyIds,[2]);
    assert.deepEqual(distributeInstallments(100,3),[34,33,33]);
  } finally { configurePersistence(undefined); }
});
