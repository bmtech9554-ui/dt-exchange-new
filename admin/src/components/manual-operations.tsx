"use client";
import { AndroidReleaseDetails } from "./android-release-details";
import { RecordDetails } from "./owner-operations";
import { PayoutReceiptUpload } from "./payout-receipt-upload";
import { SensitiveBankDetails } from "./sensitive-bank-details";
import { OwnerDepositDetails } from "./owner-deposit-details";
import { useEffect, useState } from "react";
import { Card, Button } from "./ui";
type Row = Record<string, any>;
function netCredit(amount:unknown,fee:unknown){const units=(v:unknown)=>{const s=String(v??'');if(!/^\d{1,12}(\.\d{1,6})?$/.test(s))return null;const [a,b='']=s.split('.');return BigInt(a)*BigInt(1000000)+BigInt(b.padEnd(6,'0'));};const a=units(amount),f=units(fee);if(a===null||f===null||a<=f)return 'Invalid amount';const n=a-f;return `${n/BigInt(1000000)}.${(n%BigInt(1000000)).toString().padStart(6,'0')} USDT`;}

export function ManualOperations({
  module,
  initialRows = [],
  initialSelection = null,
  initialBank = null,
}: {
  module: string;
  initialRows?: Row[];
  initialSelection?: Row | null;
  initialBank?: Row | null;
}) {
  const area =
    module === "manual-deposits"
      ? "deposits"
      : module === "manual-payouts"
        ? "payouts"
        : "releases";
  const [rows, setRows] = useState<Row[]>(initialRows),
    [selected, setSelected] = useState<Row | null>(initialSelection),
    [bank, setBank] = useState<Row | null>(initialBank),
    [receiptId,setReceiptId] = useState<string|null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false),
    [page, setPage] = useState(1),
    [metrics, setMetrics] = useState<Row>({});
  async function api(path: string, body?: unknown, code?:string) {
    const multipart = body instanceof FormData;
    const r = await fetch("/api/operations/" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: { ...(multipart ? {} : { "content-type": "application/json" }),...(code?{"x-dt-admin-totp":code}:{}) },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (r.status === 401 || (path === "logout" && r.ok)) window.dispatchEvent(new Event("dt-admin-session-expired"));
    if (r.status === 401) setLogin(true);
    if (!r.ok)
      throw Error(
        d.error?.code === "ADMIN_RECENT_AUTH_REQUIRED" ? "Enter a fresh authenticator code and retry this sensitive action." : r.status === 403
          ? "Your role does not allow this action."
          : (d.error?.message ?? d.message ?? "Unable to complete request."),
      );
    return d;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setRows(await api("manual/" + area + "?page=" + page));
    if (area !== "releases")
      try {
        setMetrics(await api("manual/dashboard"));
      } catch {
        /* Dashboard requires both monitoring permissions. */
      }
  }
  useEffect(()=>{setReceiptId(null);setBank(null);},[selected?.id]);
  useEffect(() => {
    void run(load);
  }, [area, page]);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('id');if(id&&/^[0-9a-f-]{36}$/.test(id)&&area!=='releases')void run(async()=>{const r=await api(`manual/${area}/${id}`);if(!r)throw Error('Record unavailable');setSelected(r)})},[area]);
  async function view(id: string) {
    const f = await api("manual/files/" + id);
    const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "DT-Exchange-evidence." +
      (f.mime === "application/pdf"
        ? "pdf"
        : f.mime === "image/png"
          ? "png"
          : "jpg");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function data(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    value?: string,
  ) => (
    <label key={name} style={{ display: "grid", gap: 6, margin: "12px 0" }}>
      {label}
      <input
        name={name}
        type={type}
        step={type === "datetime-local" ? 1 : undefined}
        required
        defaultValue={value}
        maxLength={1000}
      />
    </label>
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">MANUAL OPERATIONS</p>
          <h1>
            {area === "deposits"
              ? "Manual Deposit Reviews"
              : area === "payouts"
                ? "Manual INR Payouts"
                : "Android Releases"}
          </h1>
          <p>
            {area === "deposits"
              ? "Verify the blockchain transaction before crediting USDT."
              : area === "payouts"
                ? "Record an external business-bank payment with its receipt."
                : "Publish verified, signed APK metadata for the official website."}
          </p>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading…</p>}
      {login && (
        <Card>
          <form
            onSubmit={(e) => {
              const f = data(e);
              void run(async () => {
                await api("login", Object.fromEntries(f));
                setLogin(false);
                await load();
              });
            }}
          >
            {field("email", "Admin email", "email")}
            {field("password", "Password", "password")}
            <Button>Sign in</Button>
          </form>
        </Card>
      )}
      <div className="stats-grid">
        {Object.entries(metrics).map(([key, value]) => (
          <Card key={key}>
            <p>{key.replaceAll("_", " ")}</p>
            <strong>{String(value)}</strong>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {(area === "deposits"
                  ? ["Deposit / User", "USDT", "TxID", "Status", "Review"]
                  : area === "payouts"
                    ? [
                        "Order / User",
                        "INR payable",
                        "Bank",
                        "Status",
                        "Action",
                      ]
                    : ["Version", "Build", "SHA-256", "Status", "Release date"]
                ).map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? r.version_code}>
                  {area === "deposits" ? (
                    <>
                      <td>
                        {r.id}
                        <br />
                        {r.user_id}
                      </td>
                      <td>{r.submitted_amount}</td>
                      <td style={{ maxWidth: 180, overflowWrap: "anywhere" }}>
                        {r.tx_hash}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        <Button
                          onClick={() => {
                            setSelected(r);
                            setBank(null);
                          }}
                        >
                          Review
                        </Button>
                      </td>
                    </>
                  ) : area === "payouts" ? (
                    <>
                      <td>
                        {r.id}
                        <br />
                        {r.user_id}
                      </td>
                      <td>
                        ₹{(BigInt(r.net_inr_minor) / BigInt(100)).toString()}.
                        {(BigInt(r.net_inr_minor) % BigInt(100))
                          .toString()
                          .padStart(2, "0")}
                      </td>
                      <td>
                        {r.bank_name} · XXXXXX{r.last_four}
                      </td>
                      <td>{r.status === 'cancelled' ? 'CANCELLED · wallet restored' : (r.lifecycle ?? "READY_FOR_MANUAL_PAYOUT")}</td>
                      <td>
                        <Button
                          onClick={() => {
                            setSelected(r);
                            setBank(null);
                          }}
                        >
                          Open
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{r.version_name}</td>
                      <td>{r.version_code}</td>
                      <td style={{ overflowWrap: "anywhere" }}>{r.sha256}</td>
                      <td>{r.active ? "Current" : "Deprecated"}</td>
                      <td>{r.created_at}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>No records available.</p>}
        <Button onClick={() => setPage(Math.max(1, page - 1))}>
          Previous
        </Button>{" "}
        <span>Page {page}</span>{" "}
        <Button onClick={() => setPage(page + 1)}>Next</Button>
      </Card>
      {area === "releases" && rows.map((r) => (
        <Card key={r.version_code}>
          <AndroidReleaseDetails release={r as Parameters<typeof AndroidReleaseDetails>[0]["release"]} />
        </Card>
      ))}
      {selected && (
        <Card>
          <h2>{selected.id}</h2>
          {area === "deposits" ? (
            <>
              <OwnerDepositDetails id={selected.id}/><p>Network: {selected.network_code}</p>
              <p>Submitted: {selected.submitted_amount} USDT · Confirmed: {selected.verified_amount ?? "Not yet verified"} · Net credited: {selected.net_credited_amount ?? "Not credited"}</p>
              <p>Minimum: {selected.policy_snapshot?.minimumDeposit ?? "See policy"} USDT · Daily usage for the request day: {selected.daily_deposit_usage ?? "Unavailable"} / {selected.policy_snapshot?.dailyDepositLimit ?? "See policy"} USDT (India time). {selected.policy_snapshot?.monthlyLimitEnabled ? `Monthly cap: ${selected.policy_snapshot.monthlyDepositLimit} USDT` : "No monthly deposit cap."}</p>
              <p>Deposit fee: {selected.policy_snapshot?.depositFeeUsdt ?? "0"} USDT. Net credit = confirmed amount less the snapshotted fee. Submission rate: {selected.rate_snapshot?.rateInr ?? "Not recorded"} INR/USDT.</p>
              <details><summary>Audit history</summary>{selected.timeline?.map((event: Row, index: number)=><p key={index}>{event.created_at}: {event.from_status ?? "New"} → {event.to_status} · {event.note}</p>)}</details>
              <p>Receiving wallet: {selected.receiver}</p>
              <p>Sender: {selected.sender ?? "Not supplied"}</p>
              <p>{selected.note}</p>
              {selected.proof_id && (
                <Button onClick={() => void run(() => view(selected.proof_id))}>
                  View private proof
                </Button>
              )}{" "}
              {selected.network_code === "tron-mainnet" && (
                <a
                  href={
                    "https://tronscan.org/#/transaction/" + selected.tx_hash
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open blockchain explorer
                </a>
              )}
              <form
                onSubmit={(e) => {
                  const f = data(e);
                  const b: Row = Object.fromEntries(f);
                  if (b.action === "approve") {
                    if (
                      !b.transactionTime ||
                      !Number.isFinite(Date.parse(b.transactionTime))
                    ) {
                      setError(
                        "Enter the verified blockchain transaction date and time.",
                      );
                      return;
                    }
                    b.confirmations = Number(b.confirmations);
                    b.chainSucceeded = b.chainSucceeded === "on";
                    b.transactionTime = new Date(
                      b.transactionTime,
                    ).toISOString();
                  } else {
                    for (const k of Object.keys(b))
                      if (!["action", "note"].includes(k)) delete b[k];
                  }
                  if(['approve','reject'].includes(String(b.action))&&!window.confirm(`${b.action} deposit ${selected.id}?\nUser: ${selected.user_id}\nSubmitted: ${selected.submitted_amount} USDT\nConfirmed: ${b.amount??b.verifiedAmount??selected.verified_amount??'See verified evidence'} USDT\nTxID: ${selected.tx_hash}\nRate snapshot: ${selected.rate_snapshot?.rateInr??'Not recorded'} INR/USDT\nFee: ${selected.policy_snapshot?.depositFeeUsdt??'0'} USDT\nFinal net credit: ${netCredit(b.amount??b.verifiedAmount??selected.verified_amount,selected.policy_snapshot?.depositFeeUsdt??'0')}\nReason: ${b.note}\nApproval can credit the internal ledger only after existing safeguards pass.`))return;
                  void run(async () => {
                    await api("manual/deposits/" + selected.id + "/review", b);
                    await load();
                    setSelected(null);
                  });
                }}
              >
                <label>
                  Action
                  <select name="action">
                    <option value="start">Start Review</option>
                    <option value="information">
                      Request More Information
                    </option>
                    <option value="reject">Reject</option>
                    <option value="approve">Approve Deposit</option>
                  </select>
                </label>
                {field("note", "Verification note / rejection reason")}
                <details>
                  <summary>
                    Approval verification — all fields required for approval
                  </summary>
                  {[
                    "verifiedAmount",
                    "txHash",
                    "receiver",
                    "contract",
                    "sender",
                    "blockNumber",
                    "blockHash",
                  ].map((n) => (
                    <label key={n} style={{ display: "grid", margin: 12 }}>
                      {n}
                      <input
                        name={n}
                        defaultValue={
                          n === "txHash"
                            ? selected.tx_hash
                            : n === "receiver"
                              ? selected.receiver
                              : undefined
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Confirmations
                    <input name="confirmations" type="number" min="1" />
                  </label>
                  <label>
                    Blockchain transaction time
                    <input name="transactionTime" type="datetime-local" step="0.001" />
                  </label>
                  <label>
                    <input name="chainSucceeded" type="checkbox" /> I verified
                    successful USDT transfer, token, network, recipient, amount
                    and confirmations independently.
                  </label>
                </details>
                <Button disabled={busy}>Submit review</Button>
              </form>
            </>
          ) : (
            <>
              <p>
                USDT sold: {selected.amount_usdt} · locked rate ₹
                {selected.rate_inr}
              </p>
              <RecordDetails data={{user:selected.user_id,order:selected.id,payout:selected.payout_id,bank:selected.bank_name,maskedAccount:selected.last_four,ifsc:selected.ifsc,quoteCreated:selected.quote_created_at,quoteExpires:selected.quote_expires_at,created:selected.payout_created_at,processed:selected.processed_at,paid:selected.manual_paid_at,failureReason:selected.failure_reason}}/>
              <p>UTR: {selected.utr ?? "Not recorded"}</p>
              {(selected.status==='failed'||(selected.status==='review'&&selected.review_reason==='MANUAL_SELL_REJECTED'&&!selected.payout_id))&&<>
                <h3>Restore wallet after confirmed non-payment</h3>
                <p>Verify that no bank payment occurred. Cancellation restores the original USDT and sell fees once and prevents another payout for this order.</p>
                <PayoutReceiptUpload key={'refund-'+selected.id} api={api} onChange={setReceiptId} noTransfer/>
                <form onSubmit={e=>{
                  const f=data(e);
                  if(!receiptId||!window.confirm('Cancel this order and restore its original wallet funds? Confirm that the bank evidence proves no transfer occurred.'))return;
                  void run(async()=>{
                    await api('manual/payouts/'+selected.id+'/refund',{receiptId,note:f.get('note'),confirm:true,noTransferConfirmed:f.get('noTransfer')==='on'});
                    setSelected(null);setReceiptId(null);await load();
                  });
                }}>
                  {field('note','No-transfer evidence and recovery reason')}
                  <label><input name="noTransfer" type="checkbox" required/> I independently verified that no bank transfer occurred</label>
                  <Button disabled={busy||!receiptId}>Cancel order and restore USDT</Button>
                </form>
              </>}
              {(selected.payout_id||bank?.payoutId)&&<SensitiveBankDetails key={selected.id} path={`manual/payouts/${selected.id}/beneficiary`}/>}
              {['PROCESSING','MANUAL_REVIEW'].includes(selected.lifecycle)&&<form onSubmit={e=>{const f=data(e);if(!window.confirm('Mark this manual payout failed? Confirm independently that no bank transfer occurred. The INR liability stays reserved; no refund, retry or transfer is initiated.'))return;void run(async()=>{await api('manual/payouts/'+selected.id+'/fail',{note:f.get('note'),confirm:true,noTransferConfirmed:f.get('noTransfer')==='on'});setSelected(null);await load();});}}><label>Failure reason<input name="note" required minLength={10} maxLength={1000}/></label><label><input name="noTransfer" type="checkbox" required/> I confirmed no transfer occurred</label><Button disabled={busy}>Mark failed — retain liability</Button></form>}
              {selected.manual_receipt_id && (
                <Button
                  onClick={() =>
                    void run(() => view(selected.manual_receipt_id))
                  }
                >
                  View payment receipt
                </Button>
              )}
              {((!selected.lifecycle&&selected.status==='payout_pending')||selected.lifecycle==='PROCESSING')&&<form
                onSubmit={(e) => {
                  const f = data(e);
                  const code=String(f.get('code')??'');f.delete('code');(e.currentTarget.elements.namedItem('code') as HTMLInputElement).value='';
                  void run(async () => {const result=await api("manual/payouts/"+selected.id+"/process",Object.fromEntries(f),code);setBank({payoutId:result.payoutId,orderId:result.orderId});});
                }}
              >
                {field("note", "Reason for approving eligible request / starting transfer")}
                <label>Authenticator code (if recent authentication is required)<input name="code" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off"/></label>
                <label>
                  Bank transfer method
                  <select name="method">
                    <option>IMPS</option>
                    <option>NEFT</option>
                    <option>RTGS</option>
                  </select>
                </label>
                <Button disabled={busy}>
                  Approve eligible request / start manual payout
                </Button>
              </form>}
              {(bank || selected.lifecycle === 'PROCESSING' || selected.lifecycle === 'MANUAL_REVIEW') && (
                <>
                  <p role="status">
                    Transfer is performed outside DT Exchange. Do not transfer
                    twice.
                  </p>
                  <dl>
                    {Object.entries({payoutId:bank?.payoutId,orderId:bank?.orderId}).filter(([,v])=>v).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {selected.lifecycle !== 'MANUAL_REVIEW' && <form
                    onSubmit={(e) => {
                      const f = data(e);
                      void run(async () => {
                        await api(
                          "manual/payouts/" + selected.id + "/review",
                          Object.fromEntries(f),
                        );
                        setSelected(null);
                        setBank(null);
                        await load();
                      });
                    }}
                  >
                    {field("note", "Reason for escalation")}
                    <Button disabled={busy}>
                      Move uncertain payment to manual review
                    </Button>
                  </form>}
                  <PayoutReceiptUpload key={selected.id} api={api} onChange={setReceiptId}/>
                  <h3>{selected.lifecycle === 'MANUAL_REVIEW' ? 'Resolve reviewed payment' : 'Mark Payment Sent'}</h3>
                  {selected.lifecycle === 'MANUAL_REVIEW' && <p>Complete review only after independently verifying the existing bank payment. If its outcome is uncertain, keep it under review.</p>}
                  <form
                    onSubmit={(e) => {
                      const f = data(e);
                      if(!window.confirm(`Mark payout ${selected.id} as paid?\nExact INR amount: ${f.get("amountInr")}\nUTR: ${f.get("utr")}\nPayment time: ${f.get("paidAt")}\nReason: ${f.get("note")}\nConfirm only after independently checking payment and receipt. This settles the internal ledger; it does not transfer INR.`))return;
                      void run(async () => {
                        if(!receiptId)throw Error('Upload and inspect the private payment proof first.');
                        const b = {
                          ...Object.fromEntries(f),
                          paidAt: new Date(
                            String(f.get("paidAt")),
                          ).toISOString(),
                          receiptId,
                          bankTransferConfirmed:f.get("bankTransferConfirmed")==="on",
                        };
                        await api(
                          "manual/payouts/" + selected.id + "/confirm",
                          b,
                        );
                        setSelected(null);
                        setBank(null);
                        await load();
                      });
                    }}
                  >
                    {field("amountInr", "Exact INR amount sent")}
                    {field("utr", "UTR / bank reference")}
                    {field("paidAt", "Payment date and time", "datetime-local")}
                    {field("bankUsed", "Business bank used")}
                    {field("note", "Admin payment verification note")}
                    <label><input name="bankTransferConfirmed" type="checkbox" required/> I independently confirmed the actual bank transfer succeeded and the UTR, amount and beneficiary match.</label>
                    <p>
                      Confirm only after checking the bank transaction and
                      receipt. This action settles the ledger.
                    </p>
                    <Button disabled={busy||!receiptId}>Confirm INR Payment</Button>
                  </form>
                </>
              )}
            </>
          )}
        </Card>
      )}
      {area === "releases" && (
        <Card>
          <h2>Publish signed release metadata</h2>
          <p>
            Use the APK verification tool to generate an attested JSON manifest.
            No unsigned release is accepted.
          </p>
          <form
            onSubmit={(e) => {
              const f = data(e);
              void run(async () => {
                await api(
                  "manual/releases",
                  JSON.parse(String(f.get("manifest"))),
                );
                await load();
              });
            }}
          >
            <textarea
              aria-label="Attested release JSON"
              name="manifest"
              required
              rows={12}
            />
            <Button disabled={busy}>Publish verified metadata</Button>
          </form>
        </Card>
      )}
    </>
  );
}
