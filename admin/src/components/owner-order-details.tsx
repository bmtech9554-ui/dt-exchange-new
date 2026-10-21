"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button,Card} from './ui';
import {RecordDetails,ownerApi} from './owner-operations';
import {SensitiveBankDetails} from './sensitive-bank-details';
export function OwnerOrderDetails({id}:{id:string}){
 const [detail,setDetail]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setDetail(null);setError('');},[id]);
 async function load(){setBusy(true);try{setDetail(await ownerApi('owner/orders/'+id));setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Card><Button disabled={busy} onClick={()=>void load()}>Full user / sell request details</Button>{error&&<p role="alert">{error}</p>}{detail&&<>
 <RecordDetails data={detail}/><SensitiveBankDetails key={id} path={detail.order.payout_id?`manual/payouts/${id}/beneficiary`:`owner/banks/${detail.order.bank_account_id}/reveal`}/>
 <Link className="button secondary" href={`/manual-payouts?id=${id}`}>Open payout details / approve eligible request</Link>
 {detail.order.status==='payout_pending'&&!detail.order.payout_id&&<form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(!window.confirm('Hold this request for manual review? Existing liabilities and balances are retained. No refund, payment or automatic retry occurs.'))return;setBusy(true);try{await ownerApi(`manual/orders/${id}/review`,{action:f.get('action'),note:f.get('note'),confirm:true});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <label>Review decision<select name="action"><option value="review">Review request</option><option value="reject">Reject request and retain liability for reconciliation</option></select></label>
 <label>Admin notes<textarea name="note" required minLength={10} maxLength={1000}/></label><p>Rejection stops payout processing and retains the recorded liability for a separate authorized resolution.</p><Button disabled={busy}>Record review decision</Button></form>}
 </>}</Card>;
}
