"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

/** Sensitive values stay only in component memory, never URLs or web storage. */
export function SensitiveBankDetails({path}:{path:string}) {
  const [details,setDetails]=useState<Record<string,string>|null>(null);
  const [open,setOpen]=useState(false),[stepUp,setStepUp]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const request=useRef(0);
  function hide(){request.current++;setDetails(null);setOpen(false);setStepUp(false);setMessage('');setBusy(false);}
  useEffect(()=>{hide();return()=>{request.current++;};},[path]);
  useEffect(()=>{
    const clear=()=>hide();
    const visibility=()=>{if(document.visibilityState==='hidden')hide();};
    window.addEventListener('dt-admin-session-expired',clear);
    window.addEventListener('blur',clear);
    document.addEventListener('visibilitychange',visibility);
    const timer=details?setTimeout(clear,30000):undefined;
    return()=>{clearTimeout(timer);window.removeEventListener('dt-admin-session-expired',clear);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);};
  },[details]);
  async function reveal(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,fields=new FormData(form),current=++request.current;
    setBusy(true);setMessage('');
    const code=String(fields.get('code')??'');
    try{
      const response=await fetch('/api/operations/'+path,{method:'POST',cache:'no-store',headers:{'content-type':'application/json',...(code?{'x-dt-admin-totp':code}:{})},body:JSON.stringify({confirm:true,reason:fields.get('reason')})});
      const result=await response.json();
      if(current!==request.current)return;
      if(response.status===401){hide();window.dispatchEvent(new Event('dt-admin-session-expired'));return;}
      if(result.error?.code==='ADMIN_RECENT_AUTH_REQUIRED'){setStepUp(true);setMessage('Enter a fresh current authenticator code.');return;}
      if(!response.ok)throw Error(response.status===403?'Your role cannot reveal bank details.':'Bank details could not be retrieved. Retry without starting a payment.');
      const bank=result.bank??{accountNumber:result.accountNumber};
      if(typeof bank.accountNumber!=='string'||!/^\d{6,34}$/.test(bank.accountNumber))throw Error('Complete bank account digits are unavailable.');
      setDetails(bank);setOpen(false);setStepUp(false);
    }catch(error){if(current===request.current)setMessage((error as Error).message);}
    finally{const input=form.elements.namedItem('code') as HTMLInputElement|null;if(input)input.value='';if(current===request.current)setBusy(false);}
  }
  return <section aria-label="Protected bank details">
    {message&&<p role="status">{message}</p>}
    {details?<><dl className="owner-record">{Object.entries(details).map(([key,value])=><div key={key}><dt>{key==='accountNumber'?'Full account number':key}</dt><dd style={{overflowWrap:'anywhere'}}>{String(value??'Not recorded')}</dd></div>)}</dl>
      <div className="owner-actions"><Button variant="secondary" onClick={hide}>Hide Account Number</Button><Button variant="secondary" onClick={()=>void navigator.clipboard.writeText(details.accountNumber).then(()=>setMessage('Account number copied.'),()=>setMessage('Copy unavailable. Select the displayed number to copy.'))}>Copy Account Number</Button></div></>
      :open?<form onSubmit={e=>void reveal(e)}><label>Reason for viewing bank details<input name="reason" required minLength={10} maxLength={500} autoComplete="off"/></label>
        {stepUp&&<label>Current authenticator code<input name="code" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label>}
        <p>Every reveal is audited. Details hide after 30 seconds or when this window loses focus.</p><div className="owner-actions"><Button disabled={busy}>Confirm reveal</Button><Button type="button" variant="secondary" disabled={busy} onClick={hide}>Cancel</Button></div></form>
      :<Button variant="secondary" onClick={()=>setOpen(true)}>Reveal Full Account Number</Button>}
  </section>;
}
