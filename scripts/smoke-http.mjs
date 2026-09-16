import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';

const base = process.env.SMOKE_URL;
const ca = readFileSync(process.env.SMOKE_CA);
let cookie;
let csrf;
function request(path, { method = 'GET', body, origin = base, token = csrf, forwarded } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(path, base), { ca, method, headers: {
      Origin: origin,
      ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { 'X-CSRF-Token': token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    } }, res => {
      let text = '';
      res.setEncoding('utf8').on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
for (const path of ['/', '/login', '/clients', '/loans', '/reports', '/users', '/clientes', '/emprestimos', '/relatorios', '/usuarios']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  assert.match(response.text, /<div id="app"><\/div>/);
  assert.match(response.headers['cache-control'], /no-cache/);
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.headers['strict-transport-security'], /max-age=/);
  const asset = response.text.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
  const bundled = await request(asset);
  assert.equal(bundled.status, 200);
  assert.match(bundled.headers['cache-control'], /max-age=31536000/);
}
assert.equal((await request('/api/health')).status, 200);
assert.equal((await request('/api/clients')).status, 401);
const challenge = await request('/api/auth/csrf');
assert.equal(challenge.status, 200);
const setCookie = challenge.headers['set-cookie'][0];
assert.match(setCookie, /^__Host-paytrack_session=/);
assert.match(setCookie, /; Secure/);
assert.match(setCookie, /; HttpOnly/);
assert.match(setCookie, /SameSite=Strict/i);
cookie = setCookie.split(';')[0];
csrf = JSON.parse(challenge.text).csrfToken;
const body = { email: 'smoke@example.test', password: process.env.SMOKE_PASSWORD };
assert.equal((await request('/api/auth/login', { method: 'POST', body, token: 'invalid' })).status, 403);
assert.equal((await request('/api/auth/login', { method: 'POST', body, origin: 'https://evil.example' })).status, 403);
const login = await request('/api/auth/login', { method: 'POST', body });
assert.equal(login.status, 200);
cookie = login.headers['set-cookie'][0].split(';')[0];
csrf = JSON.parse(login.text).csrfToken;
assert.equal((await request('/api/auth/me')).status, 200);
assert.equal((await request('/api/clients')).status, 200);
assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 200);
assert.equal((await request('/api/clients')).status, 401);
if (process.env.SMOKE_CHECK_RATE_LIMIT === '1') {
  let limited = false;
  for (let index = 0; index < 31; index++) {
    const result = await request('/api/auth/login', { method: 'POST',
      body: { email: `probe-${index}@example.test`, password: process.env.SMOKE_PASSWORD },
      forwarded: `203.0.113.${index + 1}` });
    if (result.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true, 'Forwarded IP spoofing must not bypass the persistent IP limit');
}
console.log('HTTPS, SPA, assets, sessão, login, CSRF e proteção de origem: OK');
