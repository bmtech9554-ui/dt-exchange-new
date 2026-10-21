import React from 'react';
Object.assign(globalThis,{React});
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ManualOperations} from '../src/components/manual-operations';
import {readFileSync} from 'node:fs';
for(const module of ['manual-deposits','manual-payouts','android-releases'])test('manual admin renders '+module,()=>{const html=renderToStaticMarkup(<ManualOperations module={module}/>);assert.match(html,/<h1>/);assert.match(html,/No records available/);});
test('manual payout list keeps bank numbers masked',()=>{const html=renderToStaticMarkup(<ManualOperations module="manual-payouts" initialRows={[{id:'order',user_id:'user',net_inr_minor:'850000',bank_name:'Bank',last_four:'4321'}]}/>);assert.match(html,/XXXXXX/);assert.match(html,/4321/);assert.match(html,/READY_FOR_MANUAL_PAYOUT/);});
test('download route does not advertise unsigned unavailable APK',()=>{const s=readFileSync(new URL('../src/app/download/page.tsx',import.meta.url),'utf8');assert.match(s,/signed Android release is not available/);assert.match(s,/Keep Play Protect enabled/);assert.match(s,/APK_ALLOWED_ORIGINS/);});

test('manual deposit review exposes confirmed credit, policy, daily usage and audit history',()=>{
 const html=renderToStaticMarkup(<ManualOperations module="manual-deposits" initialSelection={{id:'synthetic',network_code:'tron-mock',submitted_amount:'100',verified_amount:'100',net_credited_amount:'100',daily_deposit_usage:'100',policy_snapshot:{minimumDeposit:'100',dailyDepositLimit:'20000'},timeline:[{created_at:'2026-10-07',to_status:'CREDITED',note:'Synthetic review'}]}}/>);
 for(const text of ['Confirmed','Net credited','Daily usage','No monthly deposit cap','Audit history','Synthetic review'])assert.ok(html.includes(text));
});

test("download CTA uses approved public label",()=>{const s=readFileSync(new URL("../src/app/download/page.tsx",import.meta.url),"utf8");assert.match(s,/Download DT Exchange for Android/);});

test('reviewed manual payout offers evidence completion without starting another transfer',()=>{
 const html=renderToStaticMarkup(<ManualOperations module="manual-payouts" initialSelection={{id:'synthetic-review',payout_id:'synthetic-payout',lifecycle:'MANUAL_REVIEW',net_inr_minor:'1030000',amount_usdt:'100',rate_inr:'103'}}/>);
 assert.match(html,/Resolve reviewed payment/);
 assert.match(html,/Confirm INR Payment/);
 assert.match(html,/independently confirmed the actual bank transfer/);
 assert.doesNotMatch(html,/Approve eligible request \/ start manual payout/);
 assert.doesNotMatch(html,/Move uncertain payment to manual review/);
 assert.match(html,/Mark failed/);
});

test('failed order recovery requires private no-transfer evidence and prevents another transfer',()=>{
 const html=renderToStaticMarkup(<ManualOperations module="manual-payouts" initialSelection={{id:'failed',status:'failed',lifecycle:'FAILED',payout_id:'payout'}}/>);
 assert.match(html,/Upload No-transfer Evidence/);
 assert.match(html,/Cancel order and restore USDT/);
 assert.match(html,/disabled=""[^>]*>Cancel order and restore USDT/);
 assert.doesNotMatch(html,/Approve eligible request \/ start manual payout/);
 assert.doesNotMatch(html,/Confirm INR Payment/);
});
