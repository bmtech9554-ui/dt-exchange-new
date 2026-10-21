"use client";
import { useEffect, useState } from 'react';
import { Card, Button } from './ui';
import QRCode from 'qrcode';
function AddressQr({address}:{address:string}){const [image,setImage]=useState('');useEffect(()=>{let active=true;setImage('');if(/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address))void QRCode.toDataURL(address,{width:220,margin:4,errorCorrectionLevel:'M'}).then(url=>{if(active)setImage(url);}).catch(()=>{});return()=>{active=false;};},[address]);return image?<figure><img src={image} width={220} height={220} alt={'TRON address QR: '+address}/><figcaption style={{overflowWrap:'anywhere'}}>{address}</figcaption></figure>:null;}

export function DepositWalletSettings() {
  const [wallet,setWallet]=useState<{address:string|null;walletVersion:number}|null>(null);
  const [proposed,setProposed]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function load() {
    setBusy(true);
    try {
      const response=await fetch('/api/operations/manual/deposit-wallet',{cache:'no-store'});
      if(!response.ok)throw new Error();
      const value=await response.json();setWallet(value);setProposed(value.address??'');setMessage('');
    }catch{setMessage('Wallet settings require an authenticated administrator with settings access.');}
    finally{setBusy(false);}
  }
  return <><Card><h2>USDT deposit wallet</h2><p>TRON (TRC20) · USDT. Address changes are audited and do not enable deposits or automatic credit.</p>
    <Button type="button" variant="secondary" disabled={busy} onClick={()=>void load()}>Load wallet settings</Button>
    {message&&<p role="status">{message}</p>}
    {wallet?.address&&<><h3>Current address</h3><AddressQr address={wallet.address}/><Button type="button" variant="secondary" onClick={()=>void navigator.clipboard.writeText(wallet.address!).then(()=>setMessage('Address copied.'),()=>setMessage('Copy unavailable; select the displayed address.'))}>Copy current address</Button></>}
    {wallet&&<form key={wallet.walletVersion} onSubmit={async event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);if(!window.confirm(`Change public TRC20 receiving address?\nOld: ${wallet.address}\nNew: ${data.get('address')}\nReason: ${data.get('reason')}\nEffective after successful save. Existing deposit destinations remain unchanged.`))return;setBusy(true);
      try {
        const response=await fetch('/api/operations/manual/deposit-wallet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:data.get('address'),confirmAddress:data.get('confirmAddress'),network:'TRC20',asset:'USDT',version:wallet.walletVersion,reason:data.get('reason')})});
        if(!response.ok)throw new Error();
        await load();setMessage('Deposit wallet saved. Change recorded in the audit log.');
      }catch{setMessage('Change rejected. Check permissions, address confirmation and configuration version. Reload before retrying.');}
      finally{setBusy(false);}
    }}>
      <label>Official TRC20 deposit address<input name="address" required value={proposed} onChange={e=>setProposed(e.target.value.trim())} pattern="T[1-9A-HJ-NP-Za-km-z]{33}" minLength={34} maxLength={34}/></label>
      <h3>Proposed address preview</h3><AddressQr address={proposed}/><p>The backend validates the TRON checksum before saving.</p><label>Confirm the exact new address<input name="confirmAddress" required minLength={34} maxLength={34} autoComplete="off"/></label>
      <label>Reason for change<input name="reason" required minLength={10} maxLength={500}/></label>
      <Button type="submit" disabled={busy}>Confirm address change</Button>
    </form>}
  </Card></>;
}

export function DepositPolicySettings() {
 type Policy={minimumDeposit:string;dailyDepositLimit:string;depositFeeUsdt:string;monthlyLimitEnabled:boolean;monthlyDepositLimit:string|null;version:number};
 const [policy,setPolicy]=useState<Policy|null>(null),[monthly,setMonthly]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(){setBusy(true);try{const r=await fetch('/api/operations/manual/deposit-policy',{cache:'no-store'});if(!r.ok)throw Error();const p=await r.json();setPolicy(p);setMonthly(p.monthlyLimitEnabled===true);setMessage('');}catch{setMessage('Unable to load policy. Settings permission is required.');}finally{setBusy(false);}}
 return <Card><h2>Deposit Settings</h2><p>Limits apply to gross deposits in India time. A disabled monthly cap is stored as null. Existing requests retain their policy snapshot.</p><Button disabled={busy} onClick={()=>void load()}>Load deposit policy</Button>{message&&<p role="status">{message}</p>}{policy&&<form key={policy.version} onSubmit={async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);const next={minimumDeposit:f.get('minimum'),dailyDepositLimit:f.get('daily'),depositFeeUsdt:f.get('fee'),monthlyLimitEnabled:monthly,monthlyDepositLimit:monthly?f.get('monthly'):null,version:policy.version,reason:f.get('reason')};
 if(!window.confirm(`Confirm deposit policy change?\nMinimum: ${policy.minimumDeposit} → ${next.minimumDeposit} USDT\nFee: ${policy.depositFeeUsdt??'0'} → ${next.depositFeeUsdt} USDT\nDaily: ${policy.dailyDepositLimit} → ${next.dailyDepositLimit} USDT\nMonthly: ${policy.monthlyLimitEnabled?policy.monthlyDepositLimit:'Unlimited'} → ${monthly?next.monthlyDepositLimit:'Unlimited'}\nReason: ${next.reason}`))return;
 setBusy(true);try{const r=await fetch('/api/operations/manual/deposit-policy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)});if(!r.ok)throw Error();await load();setMessage('Deposit policy saved and audited.');}catch{setMessage('Policy change rejected. Check values, permissions and configuration version.');}finally{setBusy(false);}}}>
 <label>Minimum deposit (USDT)<input name="minimum" required inputMode="decimal" defaultValue={policy.minimumDeposit}/></label>
 <label>Fixed deposit platform fee (USDT)<input name="fee" required inputMode="decimal" defaultValue={policy.depositFeeUsdt??'0'}/></label>
 <label>Daily deposit limit (USDT)<input name="daily" required inputMode="decimal" defaultValue={policy.dailyDepositLimit}/></label>
 <label><input type="checkbox" checked={monthly} onChange={e=>setMonthly(e.target.checked)}/> Enable monthly deposit cap</label>
 {monthly?<label>Monthly deposit limit (USDT)<input name="monthly" required inputMode="decimal" defaultValue={policy.monthlyDepositLimit??''}/></label>:<p>Monthly deposits: Unlimited / no monthly cap</p>}
 <label>Reason<input name="reason" required minLength={10} maxLength={500}/></label><Button disabled={busy}>Confirm deposit policy</Button></form>}</Card>;
}
