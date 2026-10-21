import React from 'react';
Object.assign(globalThis,{React});
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {SensitiveBankDetails} from '../src/components/sensitive-bank-details';
import {PayoutReceiptUpload} from '../src/components/payout-receipt-upload';
import {OwnerOrderDetails} from '../src/components/owner-order-details';
import {ManualOperations} from '../src/components/manual-operations';
test('bank data is masked until explicit reveal and not serialized into initial markup',()=>{
 const html=renderToStaticMarkup(<SensitiveBankDetails path="owner/banks/synthetic/reveal"/>);
 assert.match(html,/Reveal Full Account Number/);assert.doesNotMatch(html,/Full account number:|input/);
});
test('receipt upload does not present upload as completed payment',()=>{
 const html=renderToStaticMarkup(<PayoutReceiptUpload api={async()=>({})} onChange={()=>{}}/>);
 assert.match(html,/does not mark a payout paid/);assert.match(html,/Upload Payment Proof/);assert.match(html,/disabled/);
});
test('completed manual payout has protected beneficiary reveal and receipt access',()=>{
 const html=renderToStaticMarkup(<ManualOperations module="manual-payouts" initialSelection={{id:'order',payout_id:'payout',lifecycle:'SUCCESS',manual_receipt_id:'receipt'}}/>);
 assert.match(html,/Reveal Full Account Number/);assert.match(html,/View payment receipt/);assert.doesNotMatch(html,/Mark Payment Sent/);
});
test('owner sell detail loads by explicit action without implying a completed payment',()=>{
 const html=renderToStaticMarkup(<OwnerOrderDetails id="synthetic"/>);assert.match(html,/Full user \/ sell request details/);assert.doesNotMatch(html,/Payment completed/);
});
