import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase } from './database-helper.js';

afterEach(async () => { app.locals.draining = false; await closeDatabase(); });
test('liveness independe do banco; readiness falha sem persistência e durante shutdown', async () => {
  assert.deepEqual((await request(app).get('/health/live').expect(200)).body, { status: 'ok' });
  assert.deepEqual((await request(app).get('/health/ready').expect(503)).body, { status: 'unavailable' });
  await openDatabase();
  const healthy = await request(app).get('/health/ready').expect(200);
  assert.equal(healthy.headers['cache-control'], 'no-store');
  assert.deepEqual(healthy.body, { status: 'ok' });
  app.locals.draining = true;
  await request(app).get('/health/ready').expect(503);
});
