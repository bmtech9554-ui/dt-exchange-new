"use client";
import { useEffect, useState } from "react";
import { Badge, Card } from "./ui";
type Payout = {
  id: string;
  orderId: string;
  userId: string;
  status: string;
  amountInrMinor: string;
  method: string;
  bank: { bankName: string; accountNumber: string; ifsc: string };
  utr: string | null;
  payoutReference: string | null;
  createdAt: string;
  updatedAt: string;
  sandbox: boolean;
  history: { status: string; created_at: string }[];
  attempts?: {
    attempt_number: number;
    lifecycle: string;
    provider_ref: string;
  }[];
};
type Issue = {
  id: string;
  payout_id: string;
  issue_type: string;
  status: string;
  safe_context: Record<string, unknown>;
  detected_at: string;
};
const tabs = [
  ["", "Payout Queue"],
  ["PROCESSING", "Processing"],
  ["SUCCESS", "Successful"],
  ["FAILED", "Failed"],
  ["MANUAL_REVIEW", "Manual Review"],
  ["REVERSED", "Reversals"],
  ["RECONCILIATION", "Reconciliation"],
];
function money(paise: string) {
  const n = BigInt(paise);
  return `₹${(n / BigInt(100)).toLocaleString("en-IN")}.${(n % BigInt(100)).toString().padStart(2, "0")}`;
}
export function PayoutOperations({
  initialRows = [],
}: { initialRows?: Payout[] } = {}) {
  const [filter, setFilter] = useState(""),
    [rows, setRows] = useState<Payout[]>(initialRows),
    [issues, setIssues] = useState<Issue[]>([]),
    [detail, setDetail] = useState<Payout | null>(null),
    [login, setLogin] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(1);
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/operations/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (r.status === 401 || (path === "logout" && r.ok)) window.dispatchEvent(new Event("dt-admin-session-expired"));
    if (r.status === 401 || path === 'logout') { setLogin(true); setRows([]);setDetail(null);setIssues([]); }
    if (!r.ok)
      throw new Error(
        d.error?.message ?? d.message ?? "Payout service unavailable",
      );
    return d;
  }
  async function load() {
    setBusy(true);
    try {
      if (filter === "RECONCILIATION") setIssues(await api("reconciliation"));
      else
        setRows(
          await api(`payouts?page=${page}${filter ? "&status=" + filter : ""}`),
        );
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
  }, [filter, page]);
  async function action(id: string, name: string, reason: string) {
    setBusy(true);
    try {
      await api(`payouts/${id}/${name}`, { reason });
      setDetail(await api("payouts/" + id));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TREASURY OPERATIONS</div>
          <h1>INR Payouts</h1>
          <p>Provider evidence. Auditable settlement. Clear accountability.</p>
        </div>
        <Badge tone="blue">DT Exchange</Badge>
      </div>
      {rows.some((p) => p.sandbox) && (
        <Card>
          <strong>Sandbox environment</strong>
          <p>
            These records represent sandbox provider outcomes. No real bank
            transfer has been made.
          </p>
        </Card>
      )}
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
              try {
                await api("login", {
                  email: f.get("email"),
                  password: f.get("password"),
                  ...(f.get("code") ? { code: f.get("code") } : {}),
                });
                await load();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label>
              Email{" "}
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password{" "}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Authenticator code{" "}
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" />
            </label>
            <button className="button primary" disabled={busy}>
              Sign in
            </button>
          </form>
        </Card>
      )}
      <div className="operations-actions">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value!);
              setPage(1);
              setDetail(null);
            }}
          >
            {label}
          </button>
        ))}
        <button disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
        <button
          onClick={async () => {
            try {
              await api("logout", {});
              setRows([]);
              setIssues([]);
              setDetail(null);
              setLogin(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Sign out
        </button>
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}>
          {filter === "RECONCILIATION" ? (
            <table>
              <thead>
                <tr>
                  <th>Mismatch</th>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td>{i.issue_type}</td>
                    <td>{i.payout_id}</td>
                    <td>{i.status}</td>
                    <td>
                      {JSON.stringify(i.safe_context)}
                      <br />
                      {new Date(i.detected_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order / User</th>
                  <th>INR Amount</th>
                  <th>Beneficiary</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            setDetail(await api("payouts/" + p.id));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {p.orderId}
                      </button>
                      <br />
                      <small>{p.userId}</small>
                    </td>
                    <td>
                      <strong>{money(p.amountInrMinor)}</strong>
                      <br />
                      {p.method}
                    </td>
                    <td>
                      {p.bank.bankName}
                      <br />
                      {p.bank.accountNumber}
                      <br />
                      <small>{p.bank.ifsc}</small>
                    </td>
                    <td>
                      <Badge tone={p.status === "SUCCESS" ? "mint" : "blue"}>
                        {p.status.replaceAll("_", " ")}
                      </Badge>
                      <br />
                      <small>{new Date(p.createdAt).toLocaleString()}</small>
                    </td>
                    <td>
                      {p.utr ?? "UTR pending"}
                      <br />
                      <small>{p.payoutReference ?? "Awaiting provider"}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {busy && <p>Loading payout records…</p>}
        {!busy && !rows.length && filter !== "RECONCILIATION" && (
          <p>No payouts on this page.</p>
        )}
        <div className="operations-actions">
          <button
            disabled={page === 1 || busy}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={rows.length < 50 || busy || filter === "RECONCILIATION"}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </Card>
      {detail && (
        <Card>
          <h2>Payout details</h2>
          <p>
            {detail.id} · {money(detail.amountInrMinor)}
          </p>
          <p>
            {detail.bank.bankName} · {detail.bank.accountNumber} ·{" "}
            {detail.method}
          </p>
          <p>UTR: {detail.utr ?? "Not yet provided"}</p>
          <p>
            Provider reference: {detail.payoutReference ?? "Not yet provided"}
          </p>
          <h3>Status history</h3>
          {detail.history.map((h, i) => (
            <p key={i}>
              {h.status} · {new Date(h.created_at).toLocaleString()}
            </p>
          ))}
          <h3>Attempts</h3>
          {detail.attempts?.map((a) => (
            <p key={a.attempt_number}>
              Attempt {a.attempt_number} · {a.lifecycle} ·{" "}
              {a.provider_ref ?? "Not submitted"}
            </p>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action(
                detail.id,
                String(f.get("action")),
                String(f.get("reason")),
              );
            }}
          >
            <label>
              Action{" "}
              <select name="action">
                <option value="refresh">Refresh provider status</option>
                {detail.status === "FAILED" && (
                  <option value="retry">Retry eligible payout</option>
                )}
                <option value="review">Move to manual review</option>
                <option value="note">Add internal note</option>
              </select>
            </label>
            <label>
              Reason{" "}
              <input
                name="reason"
                required
                minLength={10}
                maxLength={500}
                placeholder="Evidence and reason for this action"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Submit action
            </button>
          </form>
          <button onClick={() => setDetail(null)}>Close</button>
        </Card>
      )}
      <p className="muted">
        Success is confirmed by the provider. Every treasury action requires
        permission and an audit reason. Reconciliation mismatches require
        investigation.
      </p>
    </>
  );
}
