import {publicConfiguration} from "@/lib/public-configuration";
import {simulationReleaseMetadata} from '@/lib/simulation-release';
import {PublicMaintenance} from "@/components/public-maintenance";
import type { Metadata } from "next";
import { Download, ArrowLeft, ShieldCheck, Smartphone } from "lucide-react";
import { validAndroidRelease } from "@/lib/android-release";
import "../site/site.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Download Android App — DT Exchange",
  description:
    "Official DT Exchange Android releases, checksums and installation instructions.",
  alternates: { canonical: "https://dtexchange.app/download" },
};
export async function releaseMetadata() {
  try {
    if(process.env.DT_SIMULATION_RELEASE_FILE)return await simulationReleaseMetadata();
    const base = process.env.DT_BACKEND_URL;
    if (base !== "https://api.dtexchange.app/api/v1") return null;
    const r = await fetch(base + "/app/version/android", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return validAndroidRelease(
      d,
      (process.env.APK_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()),
    )
      ? d
      : null;
  } catch {
    return null;
  }
}
export default async function DownloadPage() {
  const [release,configuration]=await Promise.all([releaseMetadata(),publicConfiguration()]);
  if(configuration?.maintenance?.website)return <PublicMaintenance configuration={configuration}/>;
  const r=configuration?.config?.downloadVisible===false?null:release;
  return (
    <div className="public-site">
      <header className="site-nav">
        <a className="site-brand" href="/">
          <img src="/brand/dt-monogram.svg" width="42" height="42" alt="" />
          <span>DT Exchange</span>
        </a>
        <a href="/" className="site-text-link" style={{ marginLeft: "auto" }}>
          <ArrowLeft size={16} /> Back to website
        </a>
      </header>
      <main
        style={{ maxWidth: 850, margin: "0 auto", padding: "42px 24px 80px" }}
      >
        <p className="site-eyebrow">
          <Smartphone size={16} /> ANDROID APP
        </p>
        <h1 style={{ fontSize: "clamp(40px,8vw,64px)" }}>
          Your exchange,
          <br />
          in your pocket.
        </h1>
        <p style={{ fontSize: 22 }}>DT Exchange · Sell USDT. Receive INR.</p>
        {r?.simulation&&<p role="note" className="site-eyebrow">SIMULATION — NO REAL USDT OR INR. Balances and transactions have no monetary value. Do not send cryptocurrency, money, real bank details or personal documents. This update uses separate demo accounts; existing financial records remain unchanged.</p>}
        <section
          style={{
            background: "var(--soft-mint)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: "clamp(22px,5vw,38px)",
            margin: "32px 0",
          }}
        >
          <ShieldCheck size={30} color="var(--emerald)" />
          <h2 style={{ fontSize: 28, marginTop: 18 }}>
            Official Android release
          </h2>
          {r ? (
            <>
              <p>
                Version {r.latestVersion} · Build {r.latestVersionCode} ·{" "}
                {(Number(r.sizeBytes) / 1048576).toFixed(1)} MB
              </p>
              <p>
                Last updated:{" "}
                {new Date(r.releaseDate).toISOString().slice(0, 10)}
              </p>
              <a className="site-cta" href={r.apkUrl} download="DTExchange.apk">
                <Download size={19} /> Download DT Exchange for Android
              </a>
              <h3 style={{ marginTop: 28 }}>Release notes</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.releaseNotes}</p>
              <p>
                Minimum supported build: {r.minimumVersionCode}
                {r.mandatory ? " · Required update" : ""}
              </p>
              <h3>SHA-256 checksum</h3>
              <code
                style={{
                  display: "block",
                  overflowWrap: "anywhere",
                  fontSize: 12,
                  marginTop: 14,
                }}
              >
                {r.sha256}
              </code>
              <p>
                <a href="/downloads/DTExchange.apk.sha256">
                  Download checksum file
                </a>
              </p>
            </>
          ) : (
            <>
              <p>The signed Android release is not available yet.</p>
              <p style={{ fontSize: 12 }}>
                ANDROID_SIGNING_PENDING · A verified release artifact must be
                staged before downloads can open.
              </p>
              <button
                className="site-cta"
                disabled
                style={{ opacity: 0.48, transform: "none", border: 0 }}
              >
                <Download size={19} /> Download DT Exchange for Android
              </button>
              <p style={{ fontSize: 12, marginBottom: 0 }}>
                Version, build number, file size, release date, release notes
                and checksum will appear with the signed release. Debug and
                preview APKs are never offered here.
              </p>
            </>
          )}
        </section>
        <section>
          <h2 style={{ fontSize: 30 }}>Install in a few simple steps.</h2>
          <ol
            style={{
              paddingLeft: 22,
              lineHeight: 2.15,
              color: "var(--muted)",
              margin: "25px 0",
            }}
          >
            <li>Download DTExchange.apk from this official website.</li>
            <li>Android may ask permission to install from this browser.</li>
            <li>Allow installation from this browser/source only.</li>
            <li>Return to Downloads.</li>
            <li>Open DTExchange.apk.</li>
            <li>Tap Install.</li>
            <li>Open DT Exchange.</li>
          </ol>
          <p>
            Android may show an unknown-source warning because this app is
            installed outside Google Play.{" "}
            <strong>Keep Play Protect enabled.</strong> You can turn off the
            browser’s installation permission after installation.
          </p>
          <p>
            Updates are not silently installed. Return to this official page
            when the app notifies you about a new version. Compare the SHA-256
            checksum and never install an APK from an unsolicited message.
          </p>
        </section>
        <p style={{ fontSize: 12, marginTop: 35 }}>
          Public service launch remains pending operational and organizational
          review. No real transactions are enabled by this download page.
        </p>
      </main>
    </div>
  );
}
