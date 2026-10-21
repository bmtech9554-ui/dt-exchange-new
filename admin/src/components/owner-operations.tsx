"use client";
import { useEffect, useState, useRef } from "react";
import { Card, Button, Field } from "./ui";
import { SensitiveBankDetails } from './sensitive-bank-details';
type Row = Record<string, any>;
function UserRecordSection({ userId, name, initial }: { userId: string; name: string; initial: Row[] }) {
  const [rows, setRows] = useState(initial), [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => { request.current++; setRows(initial); setPage(1); setError(''); setBusy(false); }, [initial]);
  useEffect(() => () => { request.current++; }, []);
  async function load(next: number) {
    const current = ++request.current;
    setBusy(true);
    try {
      const result = await ownerApi(`owner/users/${userId}?section=${name}&page=${next}`);
      if (current !== request.current) return;
      setRows(result[name]); setPage(next); setError('');
    } catch (e) { if (current === request.current) setError((e as Error).message); }
    finally { if (current === request.current) setBusy(false); }
  }
  return <details><summary>{name.replace(/([A-Z])/g, ' $1')} — page {page}</summary>
    {error && <p role="alert">{error}</p>}{name==='banks'?rows.map(bank=><Card key={bank.id}><RecordDetails data={bank}/><SensitiveBankDetails path={`owner/banks/${bank.id}/reveal`}/></Card>):<RecordDetails data={rows}/>}
    <div className="toolbar"><Button disabled={busy || page === 1} onClick={() => void load(page-1)}>Previous</Button>
      <Button disabled={busy || rows.length < 50} onClick={() => void load(page+1)}>Next</Button></div>
  </details>;
}
function BankSensitiveActions({bank,onChange}:{bank:Row;onChange:()=>Promise<void>}){
 return <div><SensitiveBankDetails path={`owner/banks/${bank.id}/reveal`}/>
 {!bank.disabled_at&&<details><summary>Disable bank account</summary><p>Disables future use. Existing financial records and accepted beneficiary terms are retained.</p><ConfirmForm title="Disable bank account" initial={bank} fields={[]} onSave={async b=>{await ownerApi(`owner/banks/${bank.id}/disable`,b);await onChange()}}/></details>}</div>;
}
export async function ownerApi(path: string, body?: unknown) {
  const r = await fetch("/api/operations/" + path, {
    cache: "no-store",
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (r.status === 401)
    window.dispatchEvent(new Event("dt-admin-session-expired"));
  if (!r.ok)
    throw Error(
      r.status === 403
        ? "This action is not permitted for your role."
        : (data.message ?? data.error?.message ?? "Request unavailable."),
    );
  return data;
}
export function RecordDetails({ data }: { data: unknown }) {
  if (data === null || data === undefined)
    return <span className="muted">Not recorded</span>;
  if (Array.isArray(data))
    return data.length ? (
      <div>
        {data.map((r, i) => (
          <Card key={String(r?.id ?? i)}>
            <RecordDetails data={r} />
          </Card>
        ))}
      </div>
    ) : (
      <p>No records.</p>
    );
  if (typeof data === "object")
    return (
      <dl className="owner-record">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>
              {typeof value === "object" ? (
                <RecordDetails data={value} />
              ) : (
                String(value ?? "Not recorded")
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(data)}</span>;
}
export function ConfirmForm({
  title,
  initial,
  fields,
  onSave,
}: {
  title: string;
  initial: Row;
  fields: {
    key: string;
    label: string;
    type?: string;
    options?: string[];
    optional?: boolean;
    readOnly?: boolean;
  }[];
  onSave: (b: Row) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      key={initial.version ?? initial.id}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          b: Row = {};
        for (const field of fields)
          b[field.key] =
            field.type === "checkbox"
              ? f.get(field.key) === "on"
              : f.get(field.key);
        b.reason = f.get("reason");
        b.confirm = true;
        b.version = initial.version ?? initial.admin_version;
        const summary = fields
          .map(
            (field) =>
              `${field.label}: ${String(initial[field.key] ?? "Not recorded")} → ${String(b[field.key])}`,
          )
          .join("\n");
        if (
          !window.confirm(
            `${title}\n${summary}\nEffective: after successful save\nReason: ${b.reason}\nConfirm this audited change?`,
          )
        )
          return;
        setBusy(true);
        try {
          await onSave(b);
          setError("Saved and audit logged.");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{title}</h2>
      {fields.map((field) =>
        field.options ? (
          <label className="field" key={field.key}>
            {field.label}
            <select
              name={field.key}
              defaultValue={initial[field.key] ?? field.options[0]}
            >
              {field.options.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        ) : (
          <Field
            key={field.key}
            label={field.label}
            readOnly={field.readOnly}
            name={field.key}
            type={field.type ?? "text"}
            defaultValue={
              field.type === "checkbox"
                ? undefined
                : String(initial[field.key] ?? "")
            }
            defaultChecked={
              field.type === "checkbox"
                ? Boolean(initial[field.key])
                : undefined
            }
            required={field.type !== "checkbox" && !field.optional}
            maxLength={500}
          />
        ),
      )}
      <Field
        label="Reason for change"
        name="reason"
        required
        minLength={10}
        maxLength={500}
      />
      <Button disabled={busy}>Review and confirm</Button>
      {error && <p role="status">{error}</p>}
    </form>
  );
}
export function OwnerOperations({ module }: { module: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Row | null>(null),
    [filters, setFilters] = useState("");
  const adjustmentIntent = useRef<{
    payload: string;
    requestId: string;
  } | null>(null);
  const path =
    module === "dashboard"
      ? "owner/dashboard"
      : module === "users"
        ? `owner/users?page=${page}${filters}`
        : module === "banks"
          ? `owner/banks?page=${page}`
          : module === "health"
            ? "owner/health"
            : module === "admin-permissions"
              ? "owner/admins"
              : ["website-settings", "app-settings", "maintenance"].includes(
                    module,
                  )
                ? "owner/config/" +
                  (module === "maintenance"
                    ? "maintenance"
                    : module === "website-settings"
                      ? "website"
                      : "app")
                : module === "wallets"
                  ? `operations/wallets?page=${page}`
                  : "owner/reconciliation";
  async function load() {
    setBusy(true);
    try {
      setData(await ownerApi(path));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setSelected(null);
    void load();
  }, [path]);
  const title: Record<string, string> = {
    dashboard: "Owner Dashboard",
    users: "Users",
    banks: "Bank Accounts",
    wallets: "Wallet Management",
    health: "System Health",
    "admin-permissions": "Admin / Permissions",
    "website-settings": "Website Settings",
    "app-settings": "App Settings",
    maintenance: "Maintenance Mode",
    reconciliation: "Reconciliation",
  };
  async function select(id: string) {
    setBusy(true);
    try {
      setSelected(
        await ownerApi(
          module === "users" ? "owner/users/" + id : "owner/wallets/" + id,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">OWNER OPERATIONS</p>
          <h1>{title[module]}</h1>
          <p>Authoritative records. Confirmed changes. Audited actions.</p>
        </div>
        <Button onClick={() => void load()} disabled={busy}>
          Refresh
        </Button>
      </header>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading…</p>}
      {module === "users" && (
        <Card>
          <form
            className="owner-filters"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                q = new URLSearchParams();
              for (const [k, v] of f) if (v) q.set(k, String(v));
              setFilters("&" + q);
              setPage(1);
            }}
          >
            <Field label="User ID, exact email or India mobile" name="search" />
            <label>
              Status
              <select name="status">
                <option value="">All</option>
                {["active", "pending", "frozen", "suspended", "closed"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <Field name="from" label="Registered from" type="date" />
            <Field name="to" label="Registered through" type="date" />
            <label>
              Sort
              <select name="sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
            <Button>Search</Button>
          </form>
        </Card>
      )}
      {data && module === "dashboard" && (
        <>
          <div className="stats-grid">
            {Object.entries(data.counts).map(([key, value]) => (
              <Card key={key}>
                <p>{key.replaceAll("_", " ")}</p>
                <h2>{String(value)}</h2>
              </Card>
            ))}
          </div>
          {["rate", "wallet", "release", "maintenance", "referralPolicy"].map((key) => (
            <Card key={key}>
              <h2>{key}</h2>
              <RecordDetails data={data[key]} />
            </Card>
          ))}
          <DashboardHealth/>
        </>
      )}
      {data && module === "users" && (
        <>
          <p>{data.total} users</p>
          <div className="owner-table">
            <table>
              <thead>
                <tr>
                  {[
                    "User",
                    "Contact",
                    "Status",
                    "Registered",
                    "Balance USDT",
                    "Deposits USDT",
                    "Sold USDT",
                    "Banks",
                    "Details",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((u: Row) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      <small>User ID: {u.publicUserId}</small>
                    </td>
                    <td>
                      {u.email}
                      <small>{u.mobile}</small>
                    </td>
                    <td>{u.status}</td>
                    <td>{u.createdAt}</td>
                    <td>{u.balance}</td>
                    <td>{u.totalDeposits}</td>
                    <td>{u.totalSold}</td>
                    <td>{u.bankCount}</td>
                    <td>
                      <Button onClick={() => void select(u.id)}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {selected && module === "users" && (
        <Card>
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close user details
          </Button>
          <h2>User details</h2>
          <RecordDetails data={{user:selected.user,wallet:selected.wallet,referralCode:selected.referralCode}} />
          {['banks','deposits','orders','payouts','referrals','referralRewards','support','notes','activity'].map(name =>
            <UserRecordSection key={`${selected.user.id}:${selected.user.version}:${name}`} userId={selected.user.id} name={name} initial={selected[name] ?? []}/>)}
          {selected.user.status!=="closed"&&<details><summary>Safe account closure</summary><p>Deactivates access and preserves all financial and audit records. Pending transactions, rewards or balances must be resolved first.</p><ConfirmForm title="Close account with record retention" initial={selected.user} fields={[]} onSave={async b=>{await ownerApi(`owner/users/${selected.user.id}/close`,b);await select(selected.user.id);await load()}}/></details>}
          <ConfirmForm
            title="Edit user profile"
            initial={selected.user}
            fields={[
              { key: "name", label: "Full name" },
              { key: "email", label: "Email", type: "email" },
              { key: "mobile", label: "India mobile (+91)" },
              {
                key: "status",
                label: "Status (frozen disables access)",
                options: ["active", "frozen", "suspended"],
              },
            ]}
            onSave={async (b) => {
              await ownerApi("owner/users/" + selected.user.id, b);
              await select(selected.user.id);
              await load();
            }}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (!window.confirm("Add this permanent internal note?")) return;
              try {
                await ownerApi("owner/users/" + selected.user.id + "/notes", {
                  note: f.get("note"),
                  confirm: true,
                });
                await select(selected.user.id);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Field
              name="note"
              label="Internal/support note"
              required
              maxLength={500}
            />
            <Button>Add note</Button>
          </form>
        </Card>
      )}
      {data && module === "banks" && (
        <>
          <p>
            Withdrawals are processed within 24 hours. Ensure your bank details
            are correct.
          </p>
          {data.map((b: Row) => (
            <Card key={b.id}>
              <RecordDetails data={b} />
              <BankSensitiveActions bank={b} onChange={load}/>
              <ConfirmForm
                title="Correct bank display details"
                initial={{
                  ...b,
                  bankName: b.bank_name,
                  accountType: b.account_type ?? "",
                }}
                fields={[
                  {
                    key: "holder",
                    label: "Account holder (immutable)",
                    readOnly: true,
                  },
                  {
                    key: "bankName",
                    label: "Bank name (immutable)",
                    readOnly: true,
                  },
                  { key: "branch", label: "Branch", optional: true },
                  {
                    key: "accountType",
                    label: "Account type",
                    options: ["", "savings", "current", "other"],
                  },
                ]}
                onSave={async (v) => {
                  await ownerApi("owner/banks/" + b.id, {
                    ...v,
                    bankName: v.bankName,
                    accountType: v.accountType || null,
                  });
                  await load();
                }}
              />
              <p>
                Account number and IFSC replacement requires a new validated
                bank account. Holder and bank identity corrections require a new
                validated replacement account. Existing payout beneficiaries
                remain unchanged.
              </p>
            </Card>
          ))}
        </>
      )}
      {data && module === "wallets" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void select(String(new FormData(e.currentTarget).get("user")));
            }}
          >
            <Field label="User ID" name="user" required />
            <Button>Open wallet ledger</Button>
          </form>
          {data.map((r: Row, i: number) => (
            <Card key={r.account_id ?? i}>
              <RecordDetails data={r} />
              {r.user_id && (
                <Button onClick={() => void select(r.user_id)}>
                  View ledger
                </Button>
              )}
            </Card>
          ))}
          {selected && (
            <Card>
              <RecordDetails data={selected} />
            </Card>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                id = String(f.get("user"));
              if (
                !window.confirm(
                  `Post immutable ${f.get("direction")} adjustment of ${f.get("amount")} USDT to ${id}?\nReason: ${f.get("reason")}\nThis changes the internal ledger balance.`,
                )
              )
                return;
              try {
                const payload = JSON.stringify({
                  id,
                  amount: f.get("amount"),
                  direction: f.get("direction"),
                  reason: f.get("reason"),
                });
                if (
                  adjustmentIntent.current &&
                  adjustmentIntent.current.payload !== payload
                )
                  throw Error(
                    "Resolve the previous adjustment by retrying its unchanged values before starting another.",
                  );
                adjustmentIntent.current ??= {
                  payload,
                  requestId: crypto.randomUUID(),
                };
                await ownerApi("owner/wallets/" + id + "/adjust", {
                  confirm: true,
                  requestId: adjustmentIntent.current.requestId,
                  amount: f.get("amount"),
                  direction: f.get("direction"),
                  reason: f.get("reason"),
                });
                adjustmentIntent.current = null;
                await select(id);
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h2>Audited balance adjustment</h2>
            <Field name="user" label="User ID" required />
            <Field
              name="amount"
              label="USDT amount"
              inputMode="decimal"
              required
            />
            <label>
              Direction
              <select name="direction">
                <option>credit</option>
                <option>debit</option>
              </select>
            </label>
            <Field
              name="reason"
              label="Reason"
              required
              minLength={10}
              maxLength={500}
            />
            <Button variant="danger">Review adjustment</Button>
          </form>
        </>
      )}
      {data &&
        ["website-settings", "app-settings", "maintenance"].includes(
          module,
        ) && (
          <Card>
            <RecordDetails data={data} />
            <ConfirmForm
              title={title[module]}
              initial={{ ...data.value, version: data.version }}
              fields={
                module === "maintenance"
                  ? [
                      {
                        key: "app",
                        label: "App maintenance",
                        type: "checkbox",
                      },
                      {
                        key: "website",
                        label: "Website maintenance",
                        type: "checkbox",
                      },
                      {
                        key: "api",
                        label: "User API maintenance",
                        type: "checkbox",
                      },
                      { key: "message", label: "Maintenance message" },
                      { key: "scheduledAt", label: "Scheduled start (UTC ISO timestamp, blank means now)",optional:true },
                    ]
                  : [
                      {
                        key: "telegram",
                        label: "Telegram username (without @)",
                      },
                      {
                        key: "contactEmail",
                        label: "Contact email",
                        type: "email",
                        optional: true,
                      },
                      {
                        key: "announcement",
                        label: "Announcement",
                        optional: true,
                      },
                      {
                        key: "informationalText",
                        label: "Informational text",
                        optional: true,
                      },
                      {
                        key: "downloadVisible",
                        label: "Public download visible",
                        type: "checkbox",
                      },
                    ]
              }
              onSave={async (b) => {
                const { confirm, version, reason, ...value } = b;
                await ownerApi(path, {
                  confirm,
                  version,
                  reason,
                  value:
                    module === "maintenance"
                      ? { ...value, scheduledAt: value.scheduledAt||null }
                      : value,
                });
                await load();
              }}
            />
            {module === "app-settings" && (
              <p>
                Version, minimum supported build and download URLs remain
                controlled by{" "}
                <a href="/android-releases">attested Android Releases</a>.
              </p>
            )}
          </Card>
        )}
      {data &&
        ["health", "admin-permissions", "reconciliation"].includes(module) && (
          <Card>
            <RecordDetails data={data} />
          </Card>
        )}
      {["users", "banks", "wallets"].includes(module) && (
        <div className="quick-actions">
          <Button
            disabled={page === 1 || busy}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            disabled={
              busy ||
              (module === "users" ? data?.items?.length : data?.length) < 50
            }
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}

function DashboardHealth(){const [health,setHealth]=useState<unknown>(null),[error,setError]=useState('');useEffect(()=>{let active=true;ownerApi('owner/health').then(v=>{if(active)setHealth(v);},()=>{if(active)setError('Health checks unavailable or not permitted.');});return()=>{active=false;};},[]);return <Card><h2>System health, workers, HTTPS and backups</h2>{error?<p role="status">{error}</p>:health?<RecordDetails data={health}/>:<p>Checking services…</p>}</Card>;}
