import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleEndpoints,accessFromStatuses} from '../src/lib/admin-access';
import {navigation} from '../src/lib/navigation';
test('new owner modules discover backend permissions; operation role is not implicitly granted settings or release rights',()=>{
 assert.equal(moduleEndpoints.referrals,'owner/referrals');assert.equal(moduleEndpoints['referral-settings'],'owner/referral-settings');assert.equal(moduleEndpoints.notifications,'owner/notifications');
 const access=accessFromStatuses(Object.keys(moduleEndpoints).map(k=>[k,['manual-deposits','notifications'].includes(k)?200:403]));
 assert.deepEqual(access?.allowedModules,['manual-deposits','notifications']);assert.equal(access?.landing,'/manual-deposits');
 assert.equal(navigation.find(n=>n.slug==='referral-settings')?.group,'Financial Settings');
});
test('bank reveal and safe closure remain explicit audited actions with no bulk action or hidden reveal',()=>{
 const source=readFileSync('src/components/owner-operations.tsx','utf8');const sensitive=readFileSync('src/components/sensitive-bank-details.tsx','utf8');assert.match(source,/SensitiveBankDetails/);assert.match(sensitive,/Reveal Full Account Number/);assert.match(sensitive,/setTimeout\(clear,30000\)/);assert.match(source,/Safe account closure/);assert.match(source,/financial and audit records/);
 assert.doesNotMatch(source,/localStorage\.setItem/);
});
test('operational inbox retains delivery workflows and uses related-record routes',()=>{
 const source=readFileSync('src/components/admin-inbox.tsx','utf8');assert.match(source,/Delivery & announcements/);assert.match(source,/href=\{n.target\}/);assert.match(source,/notification.*\/read/);assert.match(source,/visibilityState!=="hidden"/);
});
