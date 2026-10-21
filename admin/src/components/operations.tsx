"use client";
import { useEffect, useState } from "react";
import { Badge, Card } from "./ui";
import {OwnerOrderDetails} from './owner-order-details';
type Row = Record<string, unknown>;
export function Operations({ module }: { module: "orders" | "deposits" | "reviews" }) {
  const [view, setView] = useState<string>(module),
    [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Row | null>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false);
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/operations/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (r.status === 401 || (path === "logout" && r.ok)) window.dispatchEvent(new Event("dt-admin-session-expired"));
    if (r.status === 401 || path === 'logout') { setLogin(true); setRows([]);setDetail(null); }
    if (!r.ok)
      throw new Error(data.error?.message ?? data.message ?? "Request failed");
    return data;
  }
  async function load() {
    setBusy(true);
    try {
      setRows(await api(`${view}?page=${page}`));
      setError("");
      setLogin(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [view, page]); // Explicit refresh; financial state is never simulated.
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('id');if(module==='orders'&&id&&/^[0-9a-f-]{36}$/.test(id))void api(`orders/${id}`).then(setDetail).catch(e=>setError(e.message))},[module]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OPERATIONS CONSOLE</div>
          <h1>
            {view === "reviews"
              ? "Manual Review Queue"
              : module === "orders"
                ? "Sell Orders"
                : "Blockchain Deposits"}
          </h1>
          <p>Authoritative blockchain evidence and order status.</p>
        </div>
        <Badge tone="blue">DT Exchange</Badge>
      </div>
      {error && (
        <Card>
          <p role="alert">{error}</p>
        </Card>
      )}
      {login && (
        <Card>
          <h2>Operations sign in</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("login", {
                  email: f.get("email"),
                  password: f.get("password"),
                  ...(f.get("code") ? { code: f.get("code") } : {}),
                });
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email{" "}
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password{" "}
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Authenticator code{" "}
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Sign in
            </button>
          </form>
        </Card>
      )}
      <div className="operations-actions">
        <button
          onClick={() => {
            setView(module);
            setPage(1);
          }}
        >
          Transactions
        </button>
        <button
          onClick={() => {
            setView("reviews");
            setPage(1);
          }}
        >
          Manual review queue
        </button>
        <button disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
        <button
          onClick={async () => {
            await api("logout", {});
            setRows([]);
            setLogin(true);
          }}
        >
          Sign out
        </button>
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>User / reference</th>
                <th>Amount / INR liability</th>
                <th>Status / confirmations</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td>
                    {String(r.public_user_id ?? r.user_id)}
                    <br />
                    <small>
                      {String(r.order_number ?? r.order_id ?? r.id)}
                    </small>
                  </td>
                  <td>
                    {String(r.amount_usdt ?? r.amount ?? "—")} USDT
                    <br />
                    {r.net_inr_minor
                      ? `INR minor units: ${r.net_inr_minor}`
                      : ""}
                    <br />
                    {r.rate_inr
                      ? `Rate: ${r.rate_inr} · fee minor: ${r.fee_inr_minor}`
                      : ""}
                  </td>
                  <td>
                    {String(r.status ?? r.state)}
                    <br />
                    {r.confirmations != null
                      ? `${r.confirmations} / ${r.required_confirmations}`
                      : String(r.code ?? "")}
                  </td>
                  <td style={{ maxWidth: 320, overflowWrap: "anywhere" }}>
                    {String(r.tx_hash ?? r.address ?? "")}
                    <br />
                    {r.block_number ? `Block ${r.block_number}` : ""}
                    <br />
                    {String(r.created_at ?? r.accepted_at)}
                    <br />
                    {view === "orders" && (
                      <button
                        onClick={async () => {
                          try {
                            setDetail(await api("orders/" + r.id));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        View details
                      </button>
                    )}
                    {view === "reviews" && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const reason = new FormData(e.currentTarget).get(
                            "reason",
                          );
                          try {
                            await api(`reviews/${r.id}/acknowledge`, {
                              reason,
                            });
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <input
                          name="reason"
                          required
                          minLength={10}
                          maxLength={500}
                          placeholder="Review reason (required)"
                        />
                        <button>Acknowledge</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p>{busy ? "Loading…" : "No records on this page."}</p>
          )}
        </div>
        <div className="operations-actions">
          <button
            disabled={page === 1 || busy}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={rows.length < 50 || busy}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </Card>
      {detail && (
        <Card>
          <h2>Transaction detail</h2>
          {view==='orders'&&typeof detail.orderId==='string'&&<OwnerOrderDetails key={detail.orderId} id={detail.orderId}/>}
          <dl>
            {Object.entries(detail).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd style={{ overflowWrap: "anywhere" }}>
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
          <button onClick={() => setDetail(null)}>Close</button>
        </Card>
      )}
      <p className="muted">
        Blockchain evidence is read only. Acknowledging a review records a
        reason and does not credit funds or release payouts.
      </p>
    </>
  );
}
