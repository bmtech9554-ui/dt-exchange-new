import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { securityObservation } = require('../dist/common/security-observation');

test('password/TOTP acceptance and rejection have bounded non-secret events', () => {
  for (const status of [200, 201, 401, 403, 429, 503]) {
    assert.deepEqual(securityObservation('/api/v1/admin/login', status), {
      event: 'security_auth_result', operation: 'admin_login',
      result: status < 300 ? 'accepted' : 'rejected', status,
    });
  }
});
test('untrusted URL, identifiers, query and secrets are never reflected', () => {
  const event = securityObservation('/api/v1/users/SECRET?otp=123456&token=secret', 403);
  assert.equal(JSON.stringify(event).includes('SECRET'), false);
  assert.equal(JSON.stringify(event).includes('123456'), false);
  assert.equal(event.operation, 'protected_request');
});
test('regular reads do not generate authentication events', () => {
  assert.equal(securityObservation('/api/v1/users/me', 200), null);
  assert.equal(securityObservation('/api/v1/admin/login/extra', 200), null);
});
test('OTP and refresh failure classifications retain no credential fields', () => {
  assert.equal(securityObservation('/api/v1/auth/verify-otp', 401).operation, 'otp_verify');
  assert.equal(securityObservation('/api/v1/auth/refresh', 401).operation, 'session_refresh');
  assert.equal(securityObservation('/api/v1/auth/login', 200).operation, 'user_login');
});

test('deposit conflicts are observable without claiming a specific duplicate or exposing a TxID', () => {
  assert.deepEqual(securityObservation('/api/v1/manual/deposits',409),{
    event:'security_deposit_conflict',operation:'manual_deposit_submit',result:'conflict',status:409,
  });
  assert.equal(securityObservation('/api/v1/manual/deposits',201),null);
});
