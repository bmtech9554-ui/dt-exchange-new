"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui';
type Api=(path:string,body?:unknown)=>Promise<any>;
export function PayoutReceiptUpload({api,onChange,noTransfer=false}:{api:Api;onChange:(id:string|null)=>void;noTransfer?:boolean}){
 const [file,setFile]=useState<File|null>(null),[id,setId]=useState<string|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 async function view(receipt:string){
  const current=++request.current;setBusy(true);setError('');
  try{const f=await api('manual/files/'+receipt);if(current!==request.current)return;
   if(!['image/png','image/jpeg','application/pdf'].includes(f.mime))throw Error('Unsupported receipt type.');
   const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));setPreview(URL.createObjectURL(new Blob([bytes],{type:f.mime})));
  }catch(e){if(current===request.current)setError((e as Error).message);}finally{if(current===request.current)setBusy(false);}
 }
 async function upload(){
  if(!file)return;const current=++request.current;setBusy(true);setError('');
  try{const form=new FormData();form.set('purpose','receipt');form.set('file',file);const r=await api('manual/files',form);if(current!==request.current)return;setId(r.id);onChange(r.id);setPreview('');}
  catch(e){if(current===request.current)setError((e as Error).message);}finally{if(current===request.current)setBusy(false);}
 }
 return <section aria-label="Payment proof upload"><h3>{noTransfer?'Upload No-transfer Evidence':'Upload Payment Proof'}</h3><p>Private draft only. Uploading or replacing a receipt does not mark a payout paid or change wallet balances.</p>
 <label>{noTransfer?'Bank non-payment evidence (up to 5 MB)':'Payment success screenshot or PDF (up to 5 MB)'}<input type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e=>{const f=e.target.files?.[0]??null;request.current++;setPreview('');setId(null);onChange(null);setError('');if(f&&(f.size>5242880||!['image/jpeg','image/png','application/pdf'].includes(f.type))){setFile(null);setError('Choose a JPG, PNG or PDF no larger than 5 MB.');return;}setFile(f);}}/></label>
 {file&&<p>{file.name}</p>}{error&&<p role="alert">{error}</p>}<div className="owner-actions"><Button type="button" disabled={!file||busy||!!id} onClick={()=>void upload()}>Upload selected proof</Button>{id&&<><Button type="button" disabled={busy} variant="secondary" onClick={()=>void view(id)}>View Payment Proof</Button><Button type="button" variant="secondary" onClick={()=>{request.current++;setId(null);onChange(null);setPreview('');setFile(null);}}>Remove draft selection</Button></>}</div>
 {id&&<p role="status">Proof uploaded. Choose another file to replace it before finalization.</p>}{preview&&<><a href={preview} target="_blank" rel="noopener noreferrer">Open full-size private proof</a><a href={preview} download="DT-Exchange-payment-proof">Download payment proof</a>{file?.type.startsWith('image/')&&<img src={preview} alt="Payment proof draft" style={{maxWidth:'100%',maxHeight:400,objectFit:'contain'}}/>}</>}
 </section>;
}
