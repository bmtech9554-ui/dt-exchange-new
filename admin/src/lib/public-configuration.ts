export type PublicConfiguration = {
  config: {
    telegram: string;
    contactEmail: string;
    announcement: string;
    informationalText: string;
    downloadVisible: boolean;
  } | null;
  maintenance: {
    website: boolean;
    app: boolean;
    api: boolean;
    message: string;
  } | null;
};
export async function publicConfiguration(): Promise<PublicConfiguration | null> {
  const base = process.env.DT_BACKEND_URL;
  if (base !== "https://api.dtexchange.app/api/v1") return null;
  try {
    const r = await fetch(base + "/app/configuration", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.config && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(d.config.telegram))
      return null;
    return d;
  } catch {
    return null;
  }
}

/** Public rate only; no fallback sample price and no credentials. */
export async function publicManualRate():Promise<string|null>{
 const base=process.env.DT_BACKEND_URL;if(base!=='https://api.dtexchange.app/api/v1')return null;
 try{const response=await fetch(base+'/app/terms',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return null;const data=await response.json();if(data.source!=='MANUAL_ADMIN'||typeof data.rate!=='string'||!/^\d{1,12}(\.\d{1,8})?$/.test(data.rate))return null;const [whole,fraction='']=data.rate.split('.');return whole+'.'+fraction.replace(/0+$/,'').padEnd(2,'0');}catch{return null;}
}
