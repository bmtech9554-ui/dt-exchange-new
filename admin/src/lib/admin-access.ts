/** Read-only access discovery; backend guards remain authoritative. */
export const moduleEndpoints: Record<string, string> = {
  "manual-deposits": "manual/deposits", "manual-payouts": "manual/payouts",
  "android-releases": "manual/releases", dashboard: "owner/dashboard",
  users: "owner/users", banks: "owner/banks", deposits: "owner/deposits",
  orders: "orders", reviews: "reviews", payouts: "payouts", wallets: "operations/wallets",
  "website-settings": "owner/config/website", "app-settings": "owner/config/app", maintenance: "owner/config/maintenance",
  health: "owner/health", "admin-permissions": "owner/admins", reconciliation: "owner/reconciliation",
  "deposit-settings":"manual/deposit-policy", "deposit-wallet":"manual/deposit-wallet", "sell-settings":"operations/limits",
  rates: "operations/rates", fees: "operations/fees", limits: "operations/limits",
  referrals: "owner/referrals", "referral-settings":"owner/referral-settings", support: "engagement/support",
  notifications: "owner/notifications", audit: "operations/audit", settings: "operations/settings",
};
export type AdminAccess = { authenticated: true; allowedModules: string[]; unavailableModules: string[]; landing: string | null };
export const modulePermissions:Record<string,string[]>={
 'manual-deposits':['DEPOSIT_REVIEW'],'manual-payouts':['PAYOUT_VIEW'],'android-releases':['ANDROID_RELEASE_PUBLISH'],
 dashboard:['dashboard.read'],users:['users.read'],banks:['banks.read'],deposits:['DEPOSIT_REVIEW','users.read'],
 orders:['orders.read'],reviews:['reviews.read'],payouts:['payouts.read'],wallets:['wallets.read'],
 'website-settings':['public.settings'],'app-settings':['public.settings'],maintenance:['maintenance.manage'],
 health:['system.monitor'],'admin-permissions':['admins.read'],reconciliation:['reconciliation.read'],
 'deposit-settings':['settings.read'],'deposit-wallet':['settings.read'],'sell-settings':['settings.read'],rates:['settings.read'],fees:['settings.read'],limits:['settings.read'],
 referrals:['referrals.read'],'referral-settings':['referrals.rules'],support:['support.write'],notifications:[],audit:['audit.read'],settings:['settings.read'],
};
export function accessFromStatuses(statuses: [string, number][]): AdminAccess | null {
  if (statuses.some(([, status]) => status === 401)) return null;
  if (!statuses.some(([, status]) => status === 200 || status === 403)) throw Error("Session verification unavailable");
  const allowedModules = statuses.filter(([, status]) => status === 200).map(([slug]) => slug);
  return { authenticated: true, allowedModules,
    unavailableModules: statuses.filter(([, status]) => status !== 200 && status !== 403).map(([slug]) => slug),
    landing: allowedModules.length ? "/" + (allowedModules.includes("dashboard") ? "dashboard" : allowedModules.includes("manual-deposits") ? "manual-deposits" : allowedModules[0]) : null };
}
export async function discoverAdminAccess(base: string, token: string, request: typeof fetch = fetch) {
  const capabilities=await request(`${base}/admin/access`,{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${token}`}});
  if(capabilities.status===401){await capabilities.body?.cancel();return null;}
  if(capabilities.ok){
    const data=await capabilities.json();
    if(data.authenticated!==true||!Array.isArray(data.permissions)||data.permissions.some((p:unknown)=>typeof p!=='string'))throw Error('Session verification unavailable');
    const permissions=new Set<string>(data.permissions);
    return accessFromStatuses(Object.keys(moduleEndpoints).map(slug=>[slug,modulePermissions[slug]?.every(p=>permissions.has(p))?200:403]));
  }
  await capabilities.body?.cancel();
  if(capabilities.status!==404)throw Error('Session verification unavailable');
  // Compatibility while deploying the API before the frontend; never cache auth.
  const entries = Object.entries(moduleEndpoints);
  const statuses: [string, number][] = [];
  // Bound concurrency; discard all record bodies and return capabilities only.
  for (let offset = 0; offset < entries.length; offset += 4) {
    const group = await Promise.all(entries.slice(offset, offset + 4).map(async ([slug, path]): Promise<[string, number]> => {
      try {
        const response = await request(`${base}/admin/${path}?page=1`, {
          cache: "no-store", signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${token}` },
        });
        await response.body?.cancel();
        return [slug, response.status];
      } catch { return [slug, 503]; }
    }));
    statuses.push(...group);
    if (group.some(([, status]) => status === 401)) return null;
  }
  return accessFromStatuses(statuses);
}
