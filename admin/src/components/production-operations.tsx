"use client";
import { EngagementOperations } from "./engagement-operations";
import { DepositWalletSettings } from './deposit-wallet-settings';
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Skeleton } from "./ui";
type Row = Record<string, unknown>;
const titles: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  banks: "Bank Accounts",
  wallets: "Wallet Management",
  rates: "Rates",
  fees: "Fees",
  limits: "Limits",
  audit: "Audit Logs",
  settings: "Operational Settings",
  providers: "Provider Health",
  health: "System Health",
  queues: "Queue Monitoring",
  ledger: "Ledger Integrity",
};
const flags = [
  "registrations",
  "deposits",
  "sell",
  "payouts",
  "referrals",
  "notifications",
  "support",
];
export function ProductionOperations({
  module,
  initialRows = [],
}: {
  module: string;
  initialRows?: Row[];
}) {
  const [area, setArea] = useState(module),
    [rows, setRows] = useState<Row[]>(initialRows),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/operations/" + path, {
      cache: "no-store",
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (r.status === 401 || (path === "logout" && r.ok)) window.dispatchEvent(new Event("dt-admin-session-expired"));
    if (r.status === 401 || path === "logout") {
      setLogin(true);
      setRows([]);
    }
    if (!r.ok)
      throw new Error(
        r.status === 403
          ? "Your role does not allow this action."
          : (d.error?.message ??
            d.message ??
            "Service temporarily unavailable."),
      );
    return d;
  }
  async function load() {
    setBusy(true);
    try {
      setRows(
        await api(
          `operations/${area}?page=${page}&search=${encodeURIComponent(search)}`,
        ),
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
  }, [area, page]);
  async function action(path: string, body: unknown) {
    setBusy(true);
    try {
      await api(path, body);
      // Authentication succeeded even when the current module is restricted.
      if (path === "login") setLogin(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const links =
    module === "settings"
      ? ["settings", "providers", "health", "queues", "ledger"]
      : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OPERATIONS CONSOLE</div>
          <h1>{titles[area]}</h1>
          <p>Accountable operations. Clear, permission-controlled access.</p>
        </div>
        <Badge tone="blue">DT Exchange</Badge>
      </div>
      {links.length > 0 && (
        <div className="quick-actions">
          {links.map((x) => (
            <Button
              key={x}
              variant="secondary"
              onClick={() => {
                setArea(x);
                setPage(1);
              }}
            >
              {titles[x]}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <Card>
          <p role="alert">{error}</p>
        </Card>
      )}
      {login && (
        <Card>
          <h2>Administrator sign in</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await action("login", {
                email: f.get("email"),
                password: f.get("password"),
                ...(f.get("code") ? { code: f.get("code") } : {}),
              });
            }}
          >
            <Field
              label="Email"
              name="email"
              type="email"
              required
              autoComplete="username"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="current-password"
            />
            <Field
              label="Authenticator code"
              name="code"
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button disabled={busy}>Sign in</Button>
          </form>
        </Card>
      )}
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Field
            label="Search user ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
          <Button disabled={busy}>Refresh</Button>{" "}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void action("logout", {})}
          >
            Sign out
          </Button>
        </form>
      </Card>
      {area === 'settings' && <DepositWalletSettings />}
      {area === "queues" ? (
        <EngagementOperations module="settings" />
      ) : busy ? (
        <Card>
          <Skeleton />
          <Skeleton />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No records to show"
            description="Records appear here when available to your role."
          />
        </Card>
      ) : (
        rows
          .filter(
            (row) => area !== "providers" || row.provider !== "verification",
          )
          .map((row, index) => (
            <Card key={String(row.id ?? index)}>
              {area === "settings" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action("operations/controls", {
                      version: row.version,
                      reason: f.get("reason"),
                      controls: {
                        mode: f.get("mode"),
                        ...Object.fromEntries(
                          flags.map((k) => [k, f.get(k) === "on"]),
                        ),
                      },
                    });
                  }}
                >
                  <h2>Operational controls</h2>
                  <p>
                    Changes pause new activity. Submitted payments and incoming
                    funds continue to reconcile. In-flight submissions may
                    already have reached the provider.
                  </p>
                  <label>
                    Mode{" "}
                    <select name="mode" defaultValue={String(row.mode)}>
                      <option>NORMAL</option>
                      <option>READ_ONLY</option>
                      <option>MAINTENANCE</option>
                    </select>
                  </label>
                  {flags.map((k) => (
                    <label className="field" key={k}>
                      <span>{k}</span>
                      <input
                        type="checkbox"
                        name={k}
                        defaultChecked={row[k] === true}
                      />
                    </label>
                  ))}
                  <Field
                    name="reason"
                    label="Reason for change"
                    required
                    minLength={10}
                    maxLength={500}
                  />
                  <label>
                    <input type="checkbox" required /> I have reviewed the
                    effect on new transactions.
                  </label>
                  <Button disabled={busy}>Confirm operational change</Button>
                </form>
              ) : (
                <>
                  {["rates", "fees", "limits"].includes(area) &&
                    index === 0 && (
                      <PolicyForm
                        row={row}
                        busy={busy}
                        save={(body) => action("operations/policy", body)}
                      />
                    )}
                  <dl>
                    {Object.entries(row)
                      .filter(
                        ([key]) =>
                          !(
                            ["users", "dashboard"].includes(area) &&
                            /verification|kyc|verified_users|pending_reviews/i.test(
                              key,
                            )
                          ),
                      )
                      .map(([key, value]) => (
                        <div
                          key={key}
                          style={{ overflowWrap: "anywhere", marginBottom: 12 }}
                        >
                          <dt className="muted">{key.replaceAll("_", " ")}</dt>
                          <dd style={{ margin: 0 }}>
                            {value === null
                              ? "â€”"
                              : typeof value === "object"
                                ? "Recorded"
                                : String(value)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {area === "users" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(`operations/users/${row.id}/status`, {
                          status: f.get("status"),
                          reason: f.get("reason"),
                        });
                      }}
                    >
                      <label>
                        Account status{" "}
                        <select name="status">
                          <option value="frozen">Freeze</option>
                          <option value="suspended">Suspend</option>
                          <option value="active">Activate</option>
                        </select>
                      </label>
                      <Field
                        name="reason"
                        label="Reason"
                        required
                        minLength={10}
                        maxLength={500}
                      />
                      <label>
                        <input type="checkbox" required /> Confirm account
                        status change
                      </label>
                      <Button disabled={busy} variant="secondary">
                        Apply
                      </Button>
                    </form>
                  )}
                </>
              )}
            </Card>
          ))
      )}
      <div className="quick-actions">
        <Button
          variant="secondary"
          disabled={page === 1 || busy}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span>Page {page}</span>
        <Button
          variant="secondary"
          disabled={rows.length < 50 || busy}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </>
  );
}

function PolicyForm({
  row,
  busy,
  save,
}: {
  row: Row;
  busy: boolean;
  save: (body: unknown) => Promise<void>;
}) {
  const fields = [
    ["manualRate", "manual_rate"],
    ["minimumSell", "minimum_sell"],
    ["maximumSell", "maximum_sell"],
    ["dailyLimit", "daily_limit"],
    ["monthlyLimit", "monthly_limit"],
    ["marginBps", "margin_bps"],
    ["spreadBps", "spread_bps"],
    ["feeBasisPoints", "basis_points"],
    ["fixedFeeMinor", "flat_inr_minor"],
    ["quoteExpiry", "quote_expiry_seconds"],
  ];
  const value = (x: unknown) =>
    String(x ?? "")
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const changes=fields.map(([key,column])=>`${key}: ${value(row[column])} → ${f.get(key)}`).join('\n');
        if(!window.confirm(`Publish policy?\n${changes}\nEffective: after successful save. Existing quotes retain their terms.\nReason: ${f.get("reason")}`))return;
        void save({
          version: row.version,
          reason: f.get("reason"),
          mode: f.get("mode"),
          ...Object.fromEntries(
            fields.map(([key]) => [
              key,
              [
                "marginBps",
                "spreadBps",
                "feeBasisPoints",
                "quoteExpiry",
              ].includes(key)
                ? Number(f.get(key))
                : f.get(key),
            ]),
          ),
        });
      }}
    >
      <h2>Publish a new policy version</h2>
      <p>
        Accepted quotes and orders retain their original terms. Fees use paise
        and basis points.
      </p>
      <label>
        Rate mode{" "}
        <select name="mode" defaultValue={String(row.mode)}>
          {[
            "manual",
            "market",
            "market_plus_margin",
            "market_minus_margin",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {fields.map(([key, column]) => (
        <Field
          key={key}
          name={key}
          label={key}
          defaultValue={value(row[column])}
          required={key !== "manualRate"}
        />
      ))}
      <Field
        name="reason"
        label="Reason"
        required
        minLength={10}
        maxLength={500}
      />
      <label>
        <input type="checkbox" required /> I have reviewed rates, limits and fee
        units.
      </label>
      <Button disabled={busy}>Publish policy</Button>
    </form>
  );
}
