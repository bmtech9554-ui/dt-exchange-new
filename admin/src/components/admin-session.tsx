"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminAccess } from "@/lib/admin-access";
import { Button, Card, Field } from "./ui";

export function useAdminSession() {
  const router = useRouter();
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [phase, setPhase] = useState<"loading" | "anonymous" | "authenticated" | "unavailable">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function refresh(redirect = false) {
    const current = ++generation.current;
    try {
      const r = await fetch("/api/operations/session", { cache: "no-store" });
      if (current !== generation.current) return;
      if (r.status === 401) { setAccess(null); setPhase("anonymous"); return; }
      if (!r.ok) throw Error("Unable to verify module access. Please retry.");
      const value: AdminAccess = await r.json();
      if (current !== generation.current) return;
      setAccess(value); setPhase("authenticated"); setError("");
      if (redirect && value.landing) router.replace(value.landing);
    } catch {
      if (current === generation.current) { setPhase("unavailable"); setError("Unable to verify module access. Please retry."); }
    }
  }
  useEffect(() => {
    void refresh();
    const expired = () => { ++generation.current; setAccess(null); setPhase("anonymous"); setError(""); };
    window.addEventListener("dt-admin-session-expired", expired);
    return () => { ++generation.current; window.removeEventListener("dt-admin-session-expired", expired); };
  }, []);
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch("/api/operations/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!r.ok && r.status !== 401) throw Error();
      window.dispatchEvent(new Event("dt-admin-session-expired"));
    } catch { setError("Unable to sign out. Please retry."); }
    finally { setBusy(false); }
  }
  const gate = phase === "loading" ? <Card><p role="status">Checking administrator session…</p></Card>
    : phase === "unavailable" ? <Card><p role="alert">{error}</p><Button onClick={() => void refresh()}>Retry session check</Button></Card>
    : phase === "anonymous" ? <Card><h1>Administrator sign in</h1>
      <p>Use your existing password and authenticator.</p>{error && <p role="alert">{error}</p>}
      <form onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget; const values = new FormData(form);
        setBusy(true); setError("");
        try {
          const r = await fetch("/api/operations/login", { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: values.get("email"), password: values.get("password"), code: values.get("code") }) });
          if (!r.ok) { setError(r.status === 401 ? "Sign-in details or authenticator code were not accepted." : "Sign-in is temporarily unavailable. Please retry."); return; }
          form.reset(); setPhase("loading"); await refresh(true);
        } catch { setError("Sign-in is temporarily unavailable. Please retry."); }
        finally { setBusy(false); }
      }}>
        <Field name="email" label="Email" type="email" autoComplete="username" required />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required />
        <Field name="code" label="Authenticator code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required />
        <Button disabled={busy}>Sign in</Button>
      </form></Card> : null;
  return { access, phase, gate, logout, busy, error };
}
export function PermissionDenied({ access, unavailable = false }: { access: AdminAccess; unavailable?: boolean }) {
  return <Card><h1>{unavailable ? "Module temporarily unavailable" : "Permission denied"}</h1>
    <p>{unavailable ? "Your session is active, but this module could not be checked. Please try again later." : "You are signed in. Your role does not allow access to this page."}</p>
    {access.landing ? <Link className="button" href={access.landing}>Back to allowed operations</Link> : <p>No operational modules are currently available to this account. Contact your administrator.</p>}
  </Card>;
}
