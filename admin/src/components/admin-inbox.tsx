"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ownerApi} from "./owner-operations";
import {Button,Card} from "./ui";
import {EngagementOperations} from './engagement-operations';
type Inbox={items:{id:string;title:string;target:string;created_at:string;read_at:string|null}[];unread:string};
export function NotificationWorkspace(){const [delivery,setDelivery]=useState(false);return <><div className="owner-actions"><Button variant={delivery?'secondary':'primary'} onClick={()=>setDelivery(false)}>Operational inbox</Button><Button variant={delivery?'primary':'secondary'} onClick={()=>setDelivery(true)}>Delivery & announcements</Button></div>{delivery?<EngagementOperations module="notifications"/>:<AdminInbox/>}</>}
export function AdminNotificationBadge(){
 const [count,setCount]=useState<string|null>(null);
 useEffect(()=>{let live=true;const refresh=()=>{if(document.visibilityState!=="hidden")void ownerApi("owner/notifications").then(r=>{if(live)setCount(r.unread)}).catch(()=>{})};refresh();const timer=setInterval(refresh,60000);window.addEventListener("dt-admin-inbox-changed",refresh);document.addEventListener("visibilitychange",refresh);return()=>{live=false;clearInterval(timer);window.removeEventListener("dt-admin-inbox-changed",refresh);document.removeEventListener("visibilitychange",refresh)}},[]);
 return <Link className="notification-link" href="/notifications" aria-label={`Notifications${count===null?"":`, ${count} unread`}`}>Notifications {count!==null&&<span className="status-badge">{count}</span>}</Link>;
}
export function AdminInbox(){
 const [data,setData]=useState<Inbox|null>(null),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true,pending=false;const refresh=async()=>{if(pending||document.visibilityState==='hidden')return;pending=true;try{const r=await ownerApi(`owner/notifications?page=${page}`);if(live){setData(r);setError('');}}catch(e){if(live)setError((e as Error).message);}finally{pending=false;}};void refresh();const timer=setInterval(()=>void refresh(),30000);document.addEventListener('visibilitychange',refresh);return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)}},[page,revision]);
 async function mark(id:string,read:boolean){setBusy(true);try{await ownerApi(`owner/notifications/${id}/read`,{read});setRevision(n=>n+1);window.dispatchEvent(new Event("dt-admin-inbox-changed"))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><h1>Notifications</h1><p>Operational events visible to your role. Financial actions always require their own permissions.</p>{error&&<p role="alert">{error}</p>}{!data?<p role="status">Loading…</p>:<><p>{data.unread} unread</p>{!data.items.length&&<Card>No notifications yet.</Card>}{data.items.map(n=><Card key={n.id}><h2>{n.title}</h2><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time><p>{n.read_at?"Read":"Unread"}</p><div className="owner-actions"><Link href={n.target} onClick={()=>void mark(n.id,true)}>Open related record</Link><Button variant="secondary" disabled={busy} onClick={()=>void mark(n.id,!n.read_at)}>Mark {n.read_at?"unread":"read"}</Button></div></Card>)}<div className="owner-actions"><Button variant="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={data.items.length<30} onClick={()=>setPage(p=>p+1)}>Next</Button></div></>}</>;
}
