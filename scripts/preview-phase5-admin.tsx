// Static rendering of actual admin components with clearly labelled sandbox fixtures.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync,writeFileSync } from 'node:fs';
import { PayoutOperations } from '../admin/src/components/payout-operations';
(globalThis as any).React=React;
const rows=['PROCESSING','SUCCESS','MANUAL_REVIEW','FAILED'].map((status,i)=>({id:`SANDBOX-PAYOUT-00${i+1}`,orderId:`DT-SANDBOX-004${i+1}`,userId:`Sandbox user 00${i+1}`,status,amountInrMinor:['919877','1839754','459938','2759631'][i]!,method:'IMPS',bank:{bankName:'HDFC Bank',accountNumber:'XXXXXX4321',ifsc:'HDFC0001234'},utr:status==='SUCCESS'?'SANDBOX-UTR-002451':null,payoutReference:`SANDBOX-PROVIDER-004${i+1}`,createdAt:'2026-09-20T12:00:00Z',updatedAt:'2026-09-20T12:04:00Z',sandbox:true,history:[]}));
const content=renderToStaticMarkup(<PayoutOperations initialRows={rows}/>);
const css=readFileSync('admin/src/styles/tokens.css','utf8')+readFileSync('admin/src/app/globals.css','utf8');const logo=readFileSync('brand/dt-monogram.svg').toString('base64');
writeFileSync('docs/phase5/DT_Exchange_Phase5_Admin_Preview.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DT Exchange · Phase 5 Admin Preview</title><style>${css}main{max-width:1400px;margin:auto;padding:32px}.preview-head{display:flex;align-items:center;gap:16px;margin-bottom:30px}.operations-actions{flex-wrap:wrap}td{padding:20px 14px}button{pointer-events:none}</style><body><main><div class="preview-head"><img src="data:image/svg+xml;base64,${logo}" width="56" height="56" alt="DT Exchange"><div><strong>DT Exchange</strong><p>Static source-rendered preview · sandbox fixtures · controls disabled</p></div></div>${content}</main></body></html>`);
