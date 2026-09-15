import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { backendRoot } from '../src/config/env.js';
import { postgresOptions } from '../src/infrastructure/persistence/postgres.js';

function configuration(overrides, code = "const {env}=await import('./src/config/env.js'); console.log(env.DATABASE_CLIENT)") {
  const environment = { ...process.env, NODE_ENV:'production', FRONTEND_ORIGIN:'https://paytrack.example',
    DATABASE_URL:'postgresql://localhost/paytrack', DATABASE_SSL:'verify-full', ...overrides };
  if (overrides.DATABASE_CLIENT === undefined) delete environment.DATABASE_CLIENT;
  return spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:backendRoot,encoding:'utf8',env:environment});
}
test('produção exige PostgreSQL, URL válida e configuração explícita sem fallback SQLite', () => {
  const valid = configuration({});
  assert.equal(valid.status,0,valid.stderr); assert.equal(valid.stdout.trim(),'postgres');
  for (const options of [{DATABASE_CLIENT:'sqlite'},{DATABASE_URL:''},{DATABASE_URL:'https://localhost/db'},
    {DATABASE_POOL_MAX:'0'},{DATABASE_URL:'postgresql://localhost/db?sslmode=no-verify'}]) {
    assert.notEqual(configuration(options).status,0);
  }
  const memory = configuration({}, "const {openDatabase}=await import('./src/config/database.js'); await openDatabase(':memory:')");
  assert.notEqual(memory.status,0); assert.match(memory.stderr,/exclusivo do SQLite/);
});
test('pool limita conexões, valida TLS por padrão e não perde precisão numérica silenciosamente', () => {
  const options = postgresOptions({DATABASE_URL:'postgresql://localhost/paytrack',DATABASE_POOL_MAX:7,
    DATABASE_SSL:'verify-full',DATABASE_CONNECT_TIMEOUT_MS:5000,DATABASE_IDLE_TIMEOUT_MS:30000,DATABASE_STATEMENT_TIMEOUT_MS:30000});
  assert.equal(options.max,7); assert.equal(options.ssl.rejectUnauthorized,true);
  assert.equal(options.connectionTimeoutMillis,5000);
  assert.equal(options.types.getTypeParser(20)('100000000000'),100000000000);
  assert.equal(options.types.getTypeParser(1700)('10.25'),10.25);
  assert.throws(() => options.types.getTypeParser(20)('9007199254740993'),RangeError);
});
test('ambiente de testes ignora .env local e política LAN continua restrita ao desenvolvimento', () => {
  assert.equal(configuration({NODE_ENV:'test',DATABASE_URL:'',DATABASE_CLIENT:undefined}).stdout.trim(),'sqlite');
  const policy = configuration({NODE_ENV:'development',FRONTEND_ORIGIN:'http://localhost:5173'},
    "const {isAllowedOrigin}=await import('./src/config/origins.js'); console.log(JSON.stringify(['http://localhost:5173','http://127.0.0.1:5173','http://evil.example:5173'].map(isAllowedOrigin)))");
  assert.equal(policy.status,0,policy.stderr);
  assert.deepEqual(JSON.parse(policy.stdout),[true,true,false]);
});
