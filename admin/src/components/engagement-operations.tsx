"use client";
import { useEffect, useState } from "react";
import { Badge, Card } from "./ui";
type Row = Record<string, any>;
const groups: Record<string, string[]> = {
  support: ["support", "faq"],
  referrals: ["referrals", "rules"],
  notifications: ["notifications", "announcements"],
  settings: ["health"],
};
const labels: Record<string, string> = {
  support: "Support Tickets",
  faq: "FAQ Management",
  referrals: "Referral Review",
  rules: "Referral Rules",
  notifications: "Delivery Logs",
  announcements: "Announcements",
  health: "System Health & Queues",
};
export function EngagementOperations({
  module,
  initialRows = [],
}: {
  module: string;
  initialRows?: Row[];
}) {
  const [area, setArea] = useState(groups[module][0]),
    [rows, setRows] = useState<Row[]>(initialRows),
    [detail, setDetail] = useState<Row | null>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/operations/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (r.status === 401 || (path === "logout" && r.ok)) window.dispatchEvent(new Event("dt-admin-session-expired"));
    if (r.status === 401 || path === 'logout') { setLogin(true); setRows([]);setDetail(null); }
    if (!r.ok)
      throw new Error(d.error?.message ?? d.message ?? "Service unavailable");
    return d;
  }
  async function load() {
    setBusy(true);
    try {
      setRows(
        await api(
          `engagement/${area}?page=${page}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`,
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
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('id');if(area==='support'&&id&&/^[0-9a-f-]{36}$/.test(id))void api(`engagement/support/${id}`).then(setDetail).catch(e=>setError(e.message))},[area]);
  async function action(id: string, body: Row) {
    setBusy(true);
    try {
      await api(`engagement/${area}/${id}/action`, body);
      setDetail(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(f: FormData, key: string) {
    return String(f.get(key) ?? "");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DT EXCHANGE · ENGAGEMENT</div>
          <h1>{labels[area]}</h1>
          <p>Keep every customer informed and supported.</p>
        </div>
        <Badge tone="blue">Permission controlled</Badge>
      </div>
      <div className="toolbar">
        {groups[module].map((t) => (
          <button
            key={t}
            className={t === area ? "button" : "button secondary"}
            onClick={() => {
              setArea(t);
              setPage(1);
              setDetail(null);
            }}
          >
            {labels[t]}
          </button>
        ))}
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          Refresh
        </button>
        <button
          className="button secondary"
          onClick={() =>
            void api("logout", {})
              .then(() => setLogin(true))
              .catch((e) => setError(e.message))
          }
        >
          Sign out
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading…</p>}
      {login && (
        <Card>
          <h2>Admin sign in</h2>
          <form
            className="operations-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("login", {
                  email: field(f, "email"),
                  password: field(f, "password"),
                  ...(field(f,"code") ? {code:field(f,"code")} : {}),
                });
                await load();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label>
              Email
              <input type="email" name="email" required />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="current-password" required />
              <label>Authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" /></label>
            </label>
            <button className="button">Sign in</button>
          </form>
        </Card>
      )}
      {area === "support" && (
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <input
            aria-label="Search tickets"
            placeholder="Search ticket subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
          <select
            aria-label="Ticket status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "",
              "OPEN",
              "IN_PROGRESS",
              "WAITING_FOR_USER",
              "RESOLVED",
              "CLOSED",
            ].map((s) => (
              <option key={s} value={s}>
                {s || "All statuses"}
              </option>
            ))}
          </select>
          <button className="button secondary">Search</button>
        </form>
      )}
      {area === "health" ? (
        rows.map((r, i) => (
          <div key={i} className="metric-grid">
            <Card>
              <h2>Support backlog</h2>
              <strong className="metric-value">
                {r.supportBacklog?.total ?? "—"}
              </strong>
            </Card>
            <Card>
              <h2>Worker heartbeats</h2>
              {r.workers?.map((w: Row) => (
                <p key={w.worker}>
                  {w.worker} · {w.state} · {w.last_seen_at}
                </p>
              ))}
            </Card>
            <Card>
              <h2>Notification queues</h2>
              {r.notificationQueue?.map((q: Row) => (
                <p key={q.status}>
                  {q.status} · {q.total}
                </p>
              ))}
            </Card>
            <Card>
              <h2>Failed jobs</h2>
              {r.failedJobs?.map((j: Row) => (
                <p key={j.job_id}>
                  {j.job_name} · {j.failure_code} · {j.attempts} attempts
                </p>
              ))}
            </Card>
          </div>
        ))
      ) : (
        <Card>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {area === "support"
                      ? "Subject"
                      : area === "notifications"
                        ? "Notification"
                        : "Record"}
                  </th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td>
                      {r.subject ??
                        r.title ??
                        r.question ??
                        r.code ??
                        r.rewardType}
                      <small className="muted">{r.id ?? ""}</small>
                    </td>
                    <td>
                      <Badge tone={r.review_required ? "blue" : "mint"}>
                        {r.status ??
                          r.lifecycle ??
                          (r.published
                            ? "Published"
                            : r.enabled
                              ? "Enabled"
                              : "Draft / inactive")}
                      </Badge>
                    </td>
                    <td>
                      {area === "referrals"
                        ? `₹${(BigInt(r.reward_inr_minor ?? 0) / BigInt(100)).toString()} · ${r.review_required ? "Needs review" : "Eligibility checked"}`
                        : area === "notifications"
                          ? `${r.channel} · ${r.provider} · ${r.attempt_count} attempts`
                          : (r.category ?? r.audience ?? "Campaign rules")}
                    </td>
                    <td>
                      <button
                        className="button secondary"
                        onClick={() => {
                          if (area === "support")
                            void api("engagement/support/" + r.id)
                              .then(setDetail)
                              .catch((e) => setError(e.message));
                          else setDetail(r);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && !busy && (
            <p className="muted">No records to show.</p>
          )}
        </Card>
      )}
      <div className="toolbar">
        <button
          className="button secondary"
          disabled={page === 1 || busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="button secondary"
          disabled={rows.length < 50 || busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        {["faq", "announcements"].includes(area) && (
          <button
            className="button"
            onClick={() => setDetail({ id: crypto.randomUUID() })}
          >
            Create {area === "faq" ? "FAQ" : "announcement"}
          </button>
        )}
      </div>
      {area==='notifications'&&<button className="button secondary" onClick={()=>setDetail({id:crypto.randomUUID(),compose:true})}>Compose notification</button>}
      {detail && (
        <Card>
          <div className="toolbar">
            <h2>{detail.subject ?? detail.title ?? labels[area]}</h2>
            <button
              className="button secondary"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>
          {detail.messages?.map((m: Row) => (
            <p key={m.id}>
              <strong>{m.internal ? "Internal note" : m.authorType}</strong> ·{" "}
              {m.message}
            </p>
          ))}
          {area === "support" && (
            <p className="muted">
              User {detail.userId} · Order {detail.orderId ?? "—"} · Payout{" "}
              {detail.payoutId ?? "—"}
            </p>
          )}
          <form
            key={`${area}-${detail.id}`}
            className="operations-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              let body: Row = {
                action: field(f, "action") || "save",
                reason: field(f, "reason"),
              };
              if (area === "support")
                body = {
                  ...body,
                  message: field(f, "message"),
                  status: field(f, "status"),
                  adminId: field(f, "adminId"),
                };
              if (area === "faq")
                body = {
                  ...body,
                  question: field(f, "question"),
                  answer: field(f, "answer"),
                  category: field(f, "category"),
                  sortOrder: Number(field(f, "sortOrder")),
                  published: f.has("published"),
                };
              if (area === "announcements")
                body = {
                  ...body,
                  title: field(f, "title"),
                  message: field(f, "message"),
                  audience: field(f, "audience"),
                  priority: field(f, "priority"),
                  startsAt: new Date(field(f, "startsAt")).toISOString(),
                  endsAt: new Date(field(f, "endsAt")).toISOString(),
                  userIds: field(f, "userIds")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  published: f.has("published"),
                };
              if (area === "rules")
                body = {
                  ...body,
                  rules: {
                    enabled: f.has("enabled"),
                    rewardType: "FIXED_INR",
                    rewardAmountMinor: field(f, "rewardAmountMinor"),
                    minimumCompletedMinor: field(f, "minimumCompletedMinor"),
                    maximumRewards: Number(field(f, "maximumRewards")),
                    startsAt: new Date(field(f, "startsAt")).toISOString(),
                    endsAt: new Date(field(f, "endsAt")).toISOString(),
                  },
                };
              if (area === "notifications") {body.action=detail.compose?'send':'retry';if(detail.compose)body={...body,title:field(f,'title'),message:field(f,'message'),userIds:field(f,'userIds').split(',').map(s=>s.trim()).filter(Boolean)};}
              if (area === "referrals") body.action = "reject";
              void action(
                detail.id ?? "00000000-0000-4000-8000-000000000006",
                body,
              );
            }}
          >
            {area === "support" && (
              <>
                <label>
                  Action
                  <select name="action">
                    {["reply", "note", "status", "assign", "escalate"].map(
                      (a) => (
                        <option key={a}>{a}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Message
                  <textarea name="message" maxLength={5000} />
                </label>
                <label>
                  Status
                  <select name="status">
                    {[
                      "OPEN",
                      "IN_PROGRESS",
                      "WAITING_FOR_USER",
                      "RESOLVED",
                      "CLOSED",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Assign to admin ID
                  <input name="adminId" />
                </label>
              </>
            )}
            {area === "faq" && (
              <>
                <label>
                  Question
                  <input
                    name="question"
                    defaultValue={detail.question}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  Answer
                  <textarea
                    name="answer"
                    defaultValue={detail.answer}
                    required
                    maxLength={5000}
                  />
                </label>
                <label>
                  Category
                  <select name="category" defaultValue={detail.category}>
                    {[
                      "Getting Started",
                      "Account",
                      "Wallet",
                      "Selling USDT",
                      "Bank Accounts",
                      "Payouts",
                      "Security",
                      "Referral",
                      "Support",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort order
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    max="10000"
                    defaultValue={detail.sort_order ?? 0}
                  />
                </label>
              </>
            )}
            {area === "announcements" && (
              <>
                <label>
                  Title
                  <input
                    name="title"
                    defaultValue={detail.title}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Message
                  <textarea
                    name="message"
                    defaultValue={detail.message}
                    required
                    maxLength={2000}
                  />
                </label>
                <label>
                  Audience
                  <select name="audience" defaultValue={detail.audience}>
                    {["ALL_USERS", "VERIFIED_USERS", "SPECIFIC_USERS"].map(
                      (a) => (
                        <option key={a}>{a}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Specific user IDs (maximum 100, comma separated)
                  <textarea
                    name="userIds"
                    defaultValue={detail.user_ids?.join(",")}
                  />
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue={detail.priority}>
                    <option>NORMAL</option>
                    <option>IMPORTANT</option>
                  </select>
                </label>
              </>
            )}
            {area === "rules" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={detail.enabled}
                  />
                  Campaign enabled
                </label>
                <label>
                  Reward (paise)
                  <input
                    name="rewardAmountMinor"
                    pattern="[0-9]+"
                    defaultValue={detail.rewardAmountMinor}
                    required
                  />
                </label>
                <label>
                  Minimum completed transaction (paise)
                  <input
                    name="minimumCompletedMinor"
                    pattern="[0-9]+"
                    defaultValue={detail.minimumCompletedMinor}
                    required
                  />
                </label>
                <label>
                  Maximum rewards per referrer
                  <input
                    name="maximumRewards"
                    type="number"
                    min="1"
                    max="10000"
                    defaultValue={detail.maximumRewards}
                    required
                  />
                </label>
              </>
            )}
            {["rules", "announcements"].includes(area) && (
              <>
                <label>
                  Start
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={(detail.startsAt ?? detail.starts_at)?.slice(
                      0,
                      16,
                    )}
                    required
                  />
                </label>
                <label>
                  End
                  <input
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={(detail.endsAt ?? detail.ends_at)?.slice(
                      0,
                      16,
                    )}
                    required
                  />
                </label>
              </>
            )}
            {["faq", "announcements"].includes(area) && (
              <label>
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={detail.published}
                />
                Published
              </label>
            )}
            {area === "referrals" && (
              <p>
                Review may reject an ineligible referral. Rewards are issued
                only by the eligibility engine.
              </p>
            )}
            {area==='notifications'&&detail.compose&&<><label>Title<input name="title" maxLength={120} required/></label><label>Message<textarea name="message" maxLength={2000} required/></label><label>Active user IDs (maximum 100, comma separated)<textarea name="userIds" required/></label></>}
            {area === "notifications" && !detail.compose && (
              <p>Retry only failed deliveries below the attempt limit.</p>
            )}
            <label>
              Audit reason
              <textarea name="reason" required minLength={10} maxLength={500} />
            </label>
            <button className="button" disabled={busy}>
              {area === "referrals"
                ? "Reject referral"
                : area === "notifications"
                  ? (detail.compose?"Queue notification":"Retry delivery")
                  : "Save"}
            </button>
          </form>
        </Card>
      )}
    </>
  );
}
