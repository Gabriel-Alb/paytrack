import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { backendRoot } from '../src/config/env.js';

function run(code, overrides = {}) {
  const environment = {
    ...process.env, NODE_ENV: 'production', RENDER: 'true',
    DATABASE_CLIENT: 'postgres', DATABASE_URL: 'postgresql://localhost/paytrack',
    FRONTEND_ORIGIN: 'https://paytrack.example', COOKIE_SAME_SITE: 'strict',
    AUTH_LOGIN_IP_LIMIT: '5', AUTH_LOGIN_ACCOUNT_LIMIT: '3', AUTH_REQUEST_IP_LIMIT: '5',
    ...overrides,
  };
  delete environment.TRUST_PROXY;
  if (overrides.TRUST_PROXY !== undefined) environment.TRUST_PROXY = overrides.TRUST_PROXY;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: backendRoot, encoding: 'utf8', env: environment, timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.doesNotMatch(result.stderr, /ValidationError|ERR_ERL_/);
  return result.stdout.trim();
}

test('confiança automática em um salto fica restrita à produção no Render e preserva listas explícitas', () => {
  const code = "const {app}=await import('./src/app.js'); console.log(JSON.stringify(app.get('trust proxy')))";
  assert.equal(run(code), '1');
  for (const RENDER of ['', 'false', 'TRUE']) assert.equal(run(code, { RENDER }), 'false');
  for (const NODE_ENV of ['development', 'test']) {
    assert.equal(run(code, { NODE_ENV, DATABASE_CLIENT: 'sqlite', FRONTEND_ORIGIN: 'http://localhost:5173' }), 'false');
  }
  assert.deepEqual(JSON.parse(run(code, { TRUST_PROXY: 'loopback,172.30.0.2/32' })), ['loopback', '172.30.0.2/32']);
});

test('ingresso Render separa limites por cliente, ignora prefixos forjados e mantém CSRF/cookies e IPv6', () => {
  run(`
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import request from 'supertest';
    import { app } from './src/app.js';
    import { configurePersistence } from './src/application/persistence.js';

    // Isolate persistence while exercising the real production app and rate-limit middleware.
    const counters = new Map(), sessions = new Map();
    configurePersistence({
      auth: {
        insertSession: async ({ tokenHash, csrfToken, now, expiresAt }) => sessions.set(tokenHash, {
          csrf_token: csrfToken, last_seen_at: now, expires_at: expiresAt,
        }),
        sessionByHash: async (hash) => sessions.get(hash),
      },
      'rate-limits': { increment: async (key) => {
        const hits = (counters.get(key) || 0) + 1;
        counters.set(key, hits);
        return { hits, reset_at: Date.now() + 900000 };
      } },
    });
    const mobile = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
    const throughProxy = (method, path, ip) => request(app)[method](path)
      .set('X-Forwarded-For', ip).set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://paytrack.example').set('User-Agent', mobile);
    await request(app).get('/api/health').expect(400);
    await throughProxy('get', '/api/health', '203.0.113.10').expect(200);

    const csrf = await throughProxy('get', '/api/auth/csrf', '203.0.113.10').expect(200);
    const cookie = csrf.headers['set-cookie'][0];
    for (const flag of ['__Host-paytrack_session=', '; Secure', '; HttpOnly', 'SameSite=Strict', 'Path=/'])
      assert.ok(cookie.includes(flag), flag);
    assert.equal(csrf.headers['access-control-allow-origin'], 'https://paytrack.example');
    for (const path of ['/api/auth/login', '/api/auth/request-access']) {
      counters.clear();
      // A valid token reaches payload validation; invalid tokens and origins still fail first.
      await throughProxy('post', path, '203.0.113.10').set('Cookie', cookie.split(';')[0])
        .set('X-CSRF-Token', csrf.body.csrfToken).send({}).expect(400);
      const denied = await throughProxy('post', path, '203.0.113.10').set('Cookie', cookie.split(';')[0])
        .set('X-CSRF-Token', 'invalid').send({}).expect(403);
      assert.equal(denied.body.error.code, 'CSRF_INVALID');
      const origin = await throughProxy('post', path, '203.0.113.10').set('Cookie', cookie.split(';')[0])
        .set('X-CSRF-Token', csrf.body.csrfToken).set('Origin', 'https://evil.example').send({}).expect(403);
      assert.equal(origin.body.error.code, 'ORIGIN_REJECTED');
    }

    for (const [path, prefix] of [['/api/auth/login', 'login-ip:'], ['/api/auth/request-access', 'request-ip:']]) {
      counters.clear();
      for (let i = 0; i < 5; i++) {
        const denied = await throughProxy('post', path, '198.51.100.' + (i + 1) + ', 203.0.113.10')
          .send({ email: 'attempt' + i + '@example.test' }).expect(403);
        assert.equal(denied.body.error.code, 'CSRF_INVALID');
      }
      const blocked = await throughProxy('post', path, '198.51.100.99, 203.0.113.10')
        .send({ email: 'another@example.test' }).expect(429);
      assert.equal(blocked.body.error.code, 'TOO_MANY_ATTEMPTS');
      await throughProxy('post', path, '203.0.113.11').send({ email: 'other@example.test' }).expect(403);
      const key = prefix + createHash('sha256').update('203.0.113.10').digest('hex');
      assert.equal(counters.get(key), 6);

      counters.clear();
      for (let i = 0; i < 3; i++)
        await throughProxy('post', path, '203.0.113.' + (20 + i)).send({ email: 'same@example.test' }).expect(403);
      await throughProxy('post', path, '203.0.113.30').send({ email: 'same@example.test' }).expect(429);
    }

    counters.clear();
    for (let i = 0; i < 100; i++)
      await throughProxy('get', '/api/auth/csrf', '2001:db8:1234:5600::1').expect(200);
    await throughProxy('get', '/api/auth/csrf', '2001:db8:1234:56ff::2').expect(429);
    await throughProxy('get', '/api/auth/csrf', '2001:db8:1234:5700::1').expect(200);
  `);
});
