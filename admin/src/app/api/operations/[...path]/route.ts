import { cookies } from "next/headers";
import { isAllowedAdminOrigin } from "@/lib/admin-origin";
import { discoverAdminAccess } from "@/lib/admin-access";
const name = "dt_admin_session";
async function proxy(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params,
    endpoint = path.join("/");
  if (endpoint === "session") {
    if (req.method !== "GET") return Response.json({ message: "Method not allowed" }, { status: 405 });
    const token = (await cookies()).get(name)?.value;
    const base = process.env.DT_BACKEND_URL ?? "http://localhost:4000/api/v1";
    const headers = { "Cache-Control": "no-store" };
    if (!token) return Response.json({ authenticated: false }, { status: 401, headers });
    if (process.env.NODE_ENV === "production" && !base.startsWith("https://"))
      return Response.json({ message: "Secure backend is not configured" }, { status: 503, headers });
    try {
      const access = await discoverAdminAccess(base, token);
      return Response.json(access ?? { authenticated: false }, { status: access ? 200 : 401, headers });
    } catch { return Response.json({ message: "Session check unavailable" }, { status: 503, headers }); }
  }
  if (
    !/^(owner\/(dashboard|health|reconciliation|admins|users|banks|deposits|referrals|referral-settings|referral-rewards\/[0-9a-f-]{36}\/release|notifications|notifications\/[0-9]{1,19}\/read|config\/(maintenance|website|app)|users\/[0-9a-f-]{36}(\/(notes|close))?|banks\/[0-9a-f-]{36}(\/(reveal|disable))?|orders\/[0-9a-f-]{36}|wallets\/[0-9a-f-]{36}(\/adjust)?|deposits\/[0-9a-f-]{36}(\/amend)?)|manual\/(orders\/[0-9a-f-]{36}\/review|deposit-wallet|deposit-policy|dashboard|deposits|payouts|releases|files|files\/[0-9a-f-]{36}|deposits\/[0-9a-f-]{36}(\/review)?|payouts\/[0-9a-f-]{36}(\/(process|confirm|review|fail|refund|beneficiary))?)|operations\/(dashboard|users|banks|wallets|audit|settings|providers|health|queues|ledger|rates|fees|limits|controls|policy)|operations\/users\/[0-9a-f-]{36}\/status|engagement\/(support|faq|referrals|rules|notifications|announcements|health)(\/[0-9a-f-]{36}(\/action)?)?|login|logout|orders|orders\/[0-9a-f-]{36}|deposits|payout-provider\/balance|payouts|payouts\/[0-9a-f-]{36}|payouts\/[0-9a-f-]{36}\/(retry|review|refresh|note)|reconciliation|reconciliation\/[0-9a-f-]{36}\/resolve|reviews|reviews\/[0-9a-f-]{36}\/acknowledge)$/.test(
      endpoint,
    )
  )
    return Response.json({ message: "Not found" }, { status: 404 });
  if (
    req.method === "POST" &&
    !isAllowedAdminOrigin(req, process.env.DT_ADMIN_ORIGIN, process.env.NODE_ENV === "production")
  )
    return Response.json({ message: "Invalid origin" }, { status: 403 });
  const store = await cookies(),
    base = process.env.DT_BACKEND_URL ?? "http://localhost:4000/api/v1";
  if (process.env.NODE_ENV === "production" && !base.startsWith("https://"))
    return Response.json(
      { message: "Secure backend is not configured" },
      { status: 503 },
    );
  try {
    let body: Uint8Array | undefined;
    if (req.method === "POST") {
      const reader = req.body?.getReader();
      const parts: Uint8Array[] = [];
      let bytes = 0;
      if (reader)
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > (endpoint === "manual/files" ? 5300000 : 65536)) {
            await reader.cancel();
            return Response.json(
              { message: "Request too large" },
              { status: 413 },
            );
          }
          parts.push(chunk.value);
        }
      body = new Uint8Array(Buffer.concat(parts));
    }
    const response = await fetch(
      `${base}/admin/${endpoint}${new URL(req.url).search}`,
      {
        method: req.method,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          "content-type":
            endpoint === "manual/files"
              ? (req.headers.get("content-type") ?? "")
              : "application/json",
          authorization: `Bearer ${store.get(name)?.value ?? ""}`,
          ...(req.headers.has('x-dt-admin-totp') ? {'x-dt-admin-totp':req.headers.get('x-dt-admin-totp')!} : {}),
        },
        ...(req.method === "POST" ? { body: body as BodyInit } : {}),
      },
    );
    const data = await response.json();
    if (endpoint === "login" && response.ok) {
      store.set(name, data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 900,
        path: "/api/operations",
      });
      return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (endpoint === "logout" || response.status === 401)
      store.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0,
        path: "/api/operations",
      });
    return Response.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "Operations service unavailable" },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
