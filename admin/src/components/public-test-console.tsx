'use client';
import {useState,useEffect} from 'react';

const base='/test-api/api/v1';
export function PublicTestConsole(){
 const [authenticated,setAuthenticated]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('');
 const [deposits,setDeposits]=useState<Record<string,any>[]>([]),[payouts,setPayouts]=useState<Record<string,any>[]>([]),[notices,setNotices]=useState<Record<string,any>[]>([]);
 const [proof,setProof]=useState<{url:string,name:string,mime:string}|null>(null);
 const [users,setUsers]=useState<Record<string,any>[]>([]),[usersPage,setUsersPage]=useState(1),[usersTotal,setUsersTotal]=useState(0);
 const [utrs,setUtrs]=useState<Record<string,string>>({});
 async function api(path:string,method='GET',body?:unknown){
   const multipart=body instanceof FormData;
   const res=await fetch(base+path,{method,credentials:'same-origin',headers:{...(!multipart?{'content-type':'application/json'}:{}),...(code?{'x-dt-admin-totp':code}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});
   const data=await res.json();
   if(res.status===401)setAuthenticated(false);
   if(!res.ok)throw new Error(data.error?.message??'Test operation failed. Sign in again if your session expired.');
   return data;
 }
 async function load(){
   await api('/admin/access');setAuthenticated(true);
   const [d,p,n,u]=await Promise.all([api('/admin/manual/deposits'),api('/admin/manual/payouts'),api('/admin/owner/notifications'),api('/admin/owner/users?page='+usersPage)]);
   setDeposits(d);setPayouts(p);setNotices(n.items??n.notifications??(Array.isArray(n)?n:[]));
   setUsers(u.items);setUsersTotal(Number(u.total));
 }
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Test operation failed');}finally{setBusy(false);}}
 useEffect(()=>{void run(load);},[]);
 useEffect(()=>()=>{if(proof)URL.revokeObjectURL(proof.url);},[proof]);
 async function view(id:string){const f=await api('/admin/manual/files/'+id);if(!['image/png','image/jpeg','application/pdf'].includes(f.mime))throw new Error('Unsupported proof');const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));setProof({url:URL.createObjectURL(new Blob([bytes],{type:f.mime})),name:'TEST-RECEIPT.'+(f.mime==='application/pdf'?'pdf':'png'),mime:f.mime});}
 const button=(label:string,action:()=>Promise<void>)=><button className="site-cta compact" disabled={busy} onClick={()=>void run(action)}>{label}</button>;
 return <div className="public-site"><main style={{maxWidth:1000,margin:'0 auto',padding:24,overflowWrap:'anywhere'}}>
  <a className="site-brand" href="/download"><img src="/brand/dt-monogram.svg" width="42" height="42" alt=""/><span>DT Exchange · Simulation Operations</span></a>
  <p className="site-eyebrow">SIMULATION — NO REAL USDT OR INR</p>
  <p>This console accesses only the isolated software test ledger. Production Owner Admin is unchanged.</p>
  {error&&<p role="alert">{error}</p>}
  {!authenticated?<form onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/admin/login','POST',{email,password,code});setPassword('');setCode('');await load();});}} style={{display:'grid',gap:14,maxWidth:420}}>
    <h1>Test administrator sign in</h1><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Current authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy} className="site-cta">Sign in</button>
   </form>:<>
    <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{button('Refresh',load)}{button('Sign out',async()=>{await api('/admin/logout','POST',{});setAuthenticated(false);setDeposits([]);setPayouts([]);setNotices([]);setUsers([]);setUtrs({});setProof(null);})}</div>
    <label>Fresh authenticator code for protected actions (if requested)<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} style={{maxWidth:220,display:'block'}}/></label>
    <h2>Demo users</h2><form onSubmit={e=>{e.preventDefault();void run(load);}}><label>Users page<input type="number" min={1} max={Math.max(1,Math.ceil(usersTotal/50))} value={usersPage} onChange={e=>setUsersPage(Math.max(1,Number(e.target.value)||1))}/></label><button disabled={busy}>Load users</button></form>
    {users.map(u=><section key={u.id} style={{border:'1px solid var(--border)',borderRadius:20,padding:20,marginBlock:16}}><h3>{u.name} · User {u.publicUserId}</h3><p>{u.status} · Demo USDT balance: {u.balance}</p>{['active','frozen'].includes(u.status)&&button(u.status==='active'?'Freeze demo access':'Restore demo access',async()=>{if(!confirm('Change access for this isolated demo user?'))return;await api('/test/admin/users/'+u.id+'/status','POST',{confirm:true,version:u.version,status:u.status==='active'?'frozen':'active'});await load();})}</section>)}
    <h2>Demo deposit reviews</h2>{deposits.length===0?<p>No test requests.</p>:deposits.map(d=><section key={d.id} style={{border:'1px solid var(--border)',borderRadius:20,padding:20,marginBlock:16}}>
      <h3>{d.submitted_amount} demo USDT · {d.status}</h3><p>User {d.public_user_id??d.user_id}</p><p>Simulated reference: {d.tx_hash}</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
      {d.proof_id&&button('View test proof',()=>view(d.proof_id))}
      {['PROOF_SUBMITTED','UNDER_REVIEW'].includes(d.status)&&button('Start / review',async()=>{await api('/admin/manual/deposits/'+d.id+'/review','POST',{action:'start',note:'Manual review of software-test simulation'});await load();})}
      {d.status==='UNDER_REVIEW'&&button('Approve demo credit',async()=>{if(!confirm('Credit this isolated demo wallet? No real USDT exists.'))return;await api('/test/admin/deposits/'+d.id+'/approve','POST',{confirmSimulation:true});await load();})}
      {['PROOF_SUBMITTED','UNDER_REVIEW'].includes(d.status)&&button('Reject demo deposit',async()=>{await api('/admin/manual/deposits/'+d.id+'/review','POST',{action:'reject',note:'Administrator rejected software-test simulation'});await load();})}
      </div></section>)}
    <h2>Demo sells and simulated payouts</h2>{payouts.length===0?<p>No test sell requests.</p>:payouts.map(p=><section key={p.id} style={{border:'1px solid var(--border)',borderRadius:20,padding:20,marginBlock:16}}>
      <h3>{p.amount_usdt} demo USDT · {p.lifecycle??p.status}</h3><p>Demo INR minor units: {p.net_inr_minor} · {p.bank_name} · {p.ifsc}</p><p>User {p.public_user_id??p.user_id}</p><p>{p.utr??'No simulated payment recorded'}</p>
      {p.status==='payout_pending'&&button('Approve simulated processing',async()=>{await api('/admin/manual/payouts/'+p.id+'/process','POST',{note:'TEST MODE - approve simulated manual payout'});await load();})}
      {p.status==='payout_pending'&&button('Reject / hold demo sell',async()=>{await api('/admin/manual/orders/'+p.id+'/review','POST',{action:'reject',confirm:true,note:'Administrator rejected demo sell; existing liability retained for review'});await load();})}
      {p.lifecycle==='PROCESSING'&&<label>Demo UTR (6–64 letters, digits or hyphens)<input value={utrs[p.id]??''} minLength={6} maxLength={64} pattern="[A-Za-z0-9-]{6,64}" onChange={e=>setUtrs(v=>({...v,[p.id]:e.target.value}))} style={{display:'block',maxWidth:'100%'}}/></label>}
      {p.lifecycle==='PROCESSING'&&<label>Attach synthetic receipt and record simulation (no transfer)<input type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(!file)return;void run(async()=>{if(!/^[A-Za-z0-9-]{6,64}$/.test(utrs[p.id]??''))throw new Error('Enter a demo UTR first');if(file.size>1048576)throw new Error('Maximum test receipt size is 1 MiB');if(!confirm('Record a simulated INR payout only? No bank transfer will occur.'))return;const form=new FormData();form.set('purpose','receipt');form.set('file',file);const upload=await api('/admin/manual/files','POST',form);await api('/test/admin/payouts/'+p.id+'/simulate','POST',{confirmSimulation:true,receiptId:upload.id,demoUtr:utrs[p.id]});await load();});e.target.value='';}}/></label>}
      {p.manual_receipt_id&&button('View test receipt',()=>view(p.manual_receipt_id))}
     </section>)}
    <h2>Test notifications</h2>{notices.map(n=><p key={n.id}>{n.title} · {n.entity_id}</p>)}
    {proof&&<section role="dialog" aria-label="Private test receipt" style={{border:'1px solid var(--border)',padding:20,borderRadius:20}}><h2>Private test proof</h2>{proof.mime.startsWith('image/')&&<img src={proof.url} alt="Synthetic test receipt" style={{maxWidth:'100%',maxHeight:'65vh',objectFit:'contain'}}/>}<p><a href={proof.url} download={proof.name}>Download test proof</a></p><button onClick={()=>setProof(null)}>Close</button></section>}
   </>}
 </main></div>;
}
