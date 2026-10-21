import type {Metadata} from 'next';
import '../site/site.css';
import {publicConfiguration} from '@/lib/public-configuration';
import {PublicMaintenance} from '@/components/public-maintenance';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Your invitation — DT Exchange',robots:{index:false,follow:false}};
export default async function Invite({searchParams}:{searchParams:Promise<{ref?:string}>}){
 const [{ref},configuration]=await Promise.all([searchParams,publicConfiguration()]);
 if(configuration?.maintenance?.website)return <PublicMaintenance configuration={configuration}/>;
 const code=typeof ref==='string'&&/^DT[A-Z0-9]{8,32}$/.test(ref)?ref:null;
 return <div className="public-site"><header className="site-nav"><a className="site-brand" href="/"><img src="/brand/dt-monogram.svg" width="42" height="42" alt="DT Exchange"/>DT Exchange</a></header><main style={{maxWidth:720,margin:'0 auto',padding:'48px 24px'}}><h1>Your invitation to DT Exchange</h1>{code?<><p>Use this referral code when registering in the official Android app.</p><p style={{overflowWrap:'anywhere',fontSize:22}}>{code}</p><a className="site-button" href={`dtexchange://app/register?ref=${encodeURIComponent(code)}`}>Open DT Exchange</a><p>New to DT Exchange? Download the official app, then enter the code on Create account.</p><a href="/download">Download official Android app</a><p>Referral eligibility and rewards follow the current in-app policy. Rewards require registration and OTP and remain separate pending manual release.</p></>:<p>This invitation is incomplete. Request the complete link from the person inviting you.</p>}</main></div>;
}
