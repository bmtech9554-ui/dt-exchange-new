import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { normalizeIndiaMobile } from '../dist/modules/auth/india-mobile.js';
import { RegisterDto } from '../dist/modules/auth/auth.dto.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
test('India OTP identities normalize consistently across register and resend', () => {
 const variants = ['9876543210', '919876543210', '+919876543210', '09876543210', ' +91 (98765) 43210 '];
 const auth = new AuthService(null, null, null, null, null);
 for (const value of variants) {
  assert.equal(normalizeIndiaMobile(value), '+919876543210');
  assert.equal(auth.normalize(value), '+919876543210');
  assert.equal(plainToInstance(RegisterDto, { mobile: value }).mobile, '+919876543210');
 }
 assert.equal(auth.normalize(' USER@Example.com '), 'user@example.com');
});
test('malformed India phone values are not repaired into valid destinations', () => {
 for (const value of ['1234567890', '987654321', '98765432100', '98abc76543210', '+91/9876543210']) {
  assert.equal(normalizeIndiaMobile(value), value);
  assert.throws(() => new AuthService(null, null, null, null, null).normalize(value));
 }
});
test('production OTP response never exposes a provider development inbox', async () => {
 const original = { NODE_ENV: process.env.NODE_ENV, AUTH_OTP_CHANNEL: process.env.AUTH_OTP_CHANNEL };
 Object.assign(process.env, { NODE_ENV: 'production', AUTH_OTP_CHANNEL: 'sms' });
 let deliveries = 0;
 const queries = [];
 const db = { query: async (sql, params) => { queries.push(sql); return { rows: sql.startsWith('SELECT * FROM users') ? [{ id: 'user', status: 'pending' }] : [] }; } };
 db.transaction = async fn => fn(db);
 const service = new AuthService(db, {digest: () => 'hashed'}, {limit: async () => {}, audit: async () => {}}, {send: async () => { deliveries++; }, takeForDevelopment: () => { throw new Error('Development inbox must not be accessed'); }}, null);
 try {
  const result = await service.requestOtp('9876543210', 'register', 'test-ip');
  assert.equal(deliveries, 1);
  assert.equal('developmentOtp' in result, false);
  assert.equal(result.resendAfterSeconds, 60);
  assert.ok(queries.some(q => q.includes("delivery_status='sent'")));
 } finally { for (const [key, value] of Object.entries(original)) { if(value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('provider failure consumes the challenge and returns a sanitized error', async () => {
 const queries = [];
 const db = { query: async sql => { queries.push(sql); return { rows: sql.startsWith('SELECT * FROM users') ? [{ id: 'user', status: 'pending' }] : [] }; } };
 db.transaction = async fn => fn(db);
 const service = new AuthService(db, {digest: () => 'hashed'}, {limit: async () => {}, audit: async () => {}}, {send: async () => { throw new Error('sensitive upstream detail'); }}, null);
 await assert.rejects(service.requestOtp('+919876543210', 'register', 'test-ip'), e => e.getStatus() === 503 && e.message === 'SMS authentication unavailable');
 assert.ok(queries.some(q => q.includes("delivery_status='failed',consumed_at=now()")));
});
test('rate-limit rejection prevents provider delivery and challenge creation', async () => {
 let calls = 0;
 const db = { query: async () => ({ rows: [{id: 'user', status: 'pending'}] }), transaction: async () => { throw new Error('Must not create a challenge'); } };
 const service = new AuthService(db, {digest: () => 'hashed'}, {limit: async () => { throw new Error('RATE_LIMITED'); }}, {send: async () => { calls++; }}, null);
 await assert.rejects(service.requestOtp('+919876543210', 'register', 'test-ip'), /RATE_LIMITED/);
 assert.equal(calls, 0);
});
