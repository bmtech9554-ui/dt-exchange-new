import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../../deployment/cloudzy/android-8018-access.json', import.meta.url)));
const expressions = policy.allowed.map(pattern => new RegExp('^' + pattern + '$'));
const allowed = (method, path) => expressions.some(pattern => pattern.test(method + ':' + path));
const id = '00000000-0000-4000-8000-000000000001';

test('release routing keeps authentication, account reads and account-management routes reachable', () => {
  for (const path of ['register','login','request-otp','verify-otp','refresh','logout','logout-all','forgot-password','reset-password','contact/request-otp','contact/verify-otp','change-password'])
    assert.ok(allowed('POST', '/api/v1/auth/' + path), path);
  for (const path of ['app/configuration','app/version/android','app/terms','users/me','rates/usdt-inr','wallet','history','settings','sessions','bank-accounts','manual/deposits','referrals/me','notifications','notifications/preferences','notifications/announcements','support/faq',`manual/files/${id}`,`history/${id}`,`sell/orders/${id}`]) {
    assert.ok(allowed('GET', '/api/v1/' + path), path);
    assert.ok(allowed('HEAD', '/api/v1/' + path), path);
  }
  for (const [method,path] of [['POST','bank-accounts'],['PATCH',`bank-accounts/${id}/default`],['DELETE',`bank-accounts/${id}`],['PATCH','settings/preferences'],['POST','settings/pin'],['POST','settings/pin/verify'],['POST','sessions/logout-others'],['DELETE',`sessions/${id}`]])
    assert.ok(allowed(method, '/api/v1/' + path), path);
});

test('release routing denies receiving address/configuration, intake, quotes, orders, rewards and every admin action', () => {
  for (const [method,path] of [
    ['GET','manual/configuration'],['POST','wallet/deposit-address'],['POST','manual/deposits'],
    ['POST',`manual/deposits/${id}/resubmit`],['POST','manual/files'],['POST','sell/quote'],
    ['POST','sell/orders'],['POST','referrals/claim'],['GET','admin/owner/dashboard'],
    ['POST',`admin/manual/deposits/${id}/review`],['POST',`admin/manual/payouts/${id}/confirm`],
    ['POST','future-financial-action'],['GET','future-receiving-address'],['POST','wallet'],
  ]) assert.equal(allowed(method,'/api/v1/' + path),false,method + ' ' + path);
});

test('release routing is exact, method-aware, closed to suffixes and does not turn a query into an allowed path', () => {
  for (const path of ['/api/v1/auth/login/execute','/api/v1/auth/login;deposit','/api/v1/manual/deposits?route=auth/login','/api/v1/manual/deposits/../../sell/orders','/api/v1/users/me/financial'])
    assert.equal(allowed('POST',path),false,path);
  assert.equal(allowed('PUT','/api/v1/bank-accounts'),false);
  assert.equal(allowed('POST','/api/v1/manual/files/' + id),false);
  assert.equal(allowed('GET','/api/v1/bank-accounts/' + id + '/default'),false);
});

test('only exact Build 8018 gets the additional restriction; backend checks remain mandatory for every client', () => {
  const text=readFileSync(new URL('../../deployment/cloudzy/android-8018-access.map.conf',import.meta.url),'utf8');
  assert.match(text,/map \$http_x_dt_version_code \$dt_8018_client \{ default 0; 8018 1; \}/);
  assert.match(text,/default 0;\s*"1:0" 1;/);
  assert.doesNotMatch(text,/proxy_set_header\s+(Authorization|X-DT-Version-Code)|auth_request off|satisfy any/i);
});

test('denied routing uses the mobile API JSON error contract and existing backend wording', () => {
  const text=readFileSync(new URL('../../deployment/cloudzy/android-8018-access.location.conf',import.meta.url),'utf8');
  assert.match(text,/default_type application\/json;/);
  const body=JSON.parse(text.match(/return 403 '([^']+)'/)[1]);
  assert.equal(body.error.message,'Service temporarily paused');
  const service=readFileSync(new URL('../src/modules/manual/manual.service.ts',import.meta.url),'utf8');
  assert.ok(service.includes(body.error.message));
});

test('future Cloudzy template deployments retain both account-access restrictions', () => {
  const template=readFileSync(new URL('../../deployment/cloudzy/nginx.conf',import.meta.url),'utf8');
  const map=readFileSync(new URL('../../deployment/cloudzy/android-8018-access.map.conf',import.meta.url),'utf8');
  const fragment=readFileSync(new URL('../../deployment/cloudzy/android-8018-access.location.conf',import.meta.url),'utf8');
  assert.ok(template.includes(map.trim()));
  const guard=fragment.split('\n').find(line=>line.startsWith('if ($dt_8018_blocked)'));
  assert.equal(template.split(guard).length-1,2);
  assert.equal(template.split('default_type application/json;').length-1,2);
});
