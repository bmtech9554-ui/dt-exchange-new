import {publicConfiguration,publicManualRate} from "@/lib/public-configuration";
import {PublicMaintenance} from "@/components/public-maintenance";
import type { Metadata } from "next";
import { releaseMetadata } from "../download/page";
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  Wallet,
  Fingerprint,
  FileCheck2,
  Landmark,
  History,
  Bell,
  ShieldCheck,
  LockKeyhole,
  BookOpen,
  Layers,
  MessageCircle,
  Check,
  Smartphone,
} from "lucide-react";
import "./site.css";
export const metadata: Metadata = {
  title: "DT Exchange — Sell USDT. Receive INR.",
  description:
    "A clear, reviewed journey from TRC20 USDT deposits to manual INR bank payouts. Explore DT Exchange for Android.",
  alternates: { canonical: "https://dtexchange.app" },
  robots: { index: false, follow: false },
};
const features = [
  [
    Wallet,
    "A wallet with a clear balance",
    "See ledger-based USDT balances, review your conversion and sell from approved funds.",
  ],
  [
    Fingerprint,
    "Every deposit has a reference",
    "Submit a TRC20 TxID, enter your amount and attach an optional screenshot.",
  ],
  [
    FileCheck2,
    "Know where things stand",
    "Follow your deposit from submission to review and approval, without guessing.",
  ],
  [
    Landmark,
    "Your bank, your payout",
    "Manage bank accounts and track the INR payout prepared for your selected account.",
  ],
  [
    History,
    "The details, all together",
    "Find deposits, sell orders, payout status, bank references and payment receipts in History.",
  ],
  [
    Bell,
    "Stay in the loop",
    "Follow account notifications and contact support from the Android app.",
  ],
] as const;
const steps = [
  [
    "01",
    "Start with your account",
    "Create an account and confirm your OTP. Add your bank account for eligible INR payouts.",
    ["Register or sign in", "Confirm your contact with OTP"],
  ],
  [
    "02",
    "Send it for review",
    "Use the provided TRC20 deposit address. Enter the amount, submit the TxID and optionally attach proof.",
    [
      "Deposit USDT via TRC20",
      "Enter amount + transaction hash",
      "Optional screenshot → Under Review",
    ],
  ],
  [
    "03",
    "A verified deposit, a clear balance",
    "An administrator checks the transaction. Only an approved deposit is credited to the ledger.",
    [
      "Admin checks the transaction",
      "Approved USDT enters your balance",
      "Review the quote → Sell USDT",
    ],
  ],
  [
    "04",
    "INR, with a payment reference",
    "Your bank payout is prepared. An administrator sends INR manually and records the UTR and receipt.",
    [
      "Bank payout prepared",
      "Admin sends INR manually",
      "UTR / receipt → Completed",
    ],
  ],
];
const faqs = [
  [
    "What is DT Exchange?",
    "DT Exchange is an Android app designed to let you deposit USDT, sell approved wallet funds and receive INR through a manually operated bank payout workflow. The public Android release is in preparation.",
  ],
  [
    "Which network does DT Exchange support for USDT?",
    "The current deposit workflow supports USDT on TRON (TRC20). Use only the network and deposit address shown in the connected app. Never send funds to a preview screenshot or sample QR code.",
  ],
  [
    "How do deposits work?",
    "Use the deposit address in the connected app, then submit the deposited USDT amount and transaction hash. A screenshot is optional where supported. Your request enters review; submitting proof does not credit the wallet.",
  ],
  [
    "Why is my deposit Under Review?",
    "An administrator must check the transaction details and approve the deposit before ledger credit. A screenshot alone is not payment confirmation. Follow the request status in the app.",
  ],
  [
    "How do I sell USDT?",
    "After your deposit is approved, choose Sell USDT, enter the amount, select an eligible bank account and review the quote before confirming. Rates and fees are shown in the app; website screenshots contain sample values.",
  ],
  [
    "How do INR bank payouts work?",
    "Payouts are handled manually. An authorized administrator prepares and sends the bank transfer, then records the UTR or bank reference and receipt. Follow the payout status in History.",
  ],
  [
    "How do I install the Android APK?",
    "When the signed release is available, visit the Download App page on this official website, download DTExchange.apk and follow the installation guide. The download stays unavailable until a verified release is staged.",
  ],
  [
    "Why does Android show an unknown-source warning?",
    "Android asks for permission when installing an app outside Google Play. Allow installation only for the browser you used for this official download. Keep Play Protect enabled and turn that browser permission off after installation if you wish.",
  ],
  [
    "How do I update DT Exchange?",
    "The app can notify you about an available version and direct you to the official download page. Updates are not silently installed. Check the version and SHA-256 checksum shown with each signed release.",
  ],
  [
    "How do I contact support?",
    "Use Support in the Android app to create a ticket and include the relevant order reference. You can also contact DT Exchange Support on Telegram at @dtexchange.",
  ],
];
export const dynamic = 'force-dynamic';
export default async function PublicSite() {
  const [release, configuration, currentRate] = await Promise.all([releaseMetadata(),publicConfiguration(),publicManualRate()]);
  if(configuration?.maintenance?.website)return <PublicMaintenance configuration={configuration}/>;
  const androidRelease=configuration?.config?.downloadVisible===false?null:release;
  const telegram=configuration?.config?.telegram??"dtexchange";
  return (
    <div className="public-site">
      {configuration?.config?.announcement&&<aside role="status" className="card">{configuration.config.announcement}</aside>}
      {configuration?.config?.informationalText&&<aside className="card">{configuration.config.informationalText}</aside>}
      {configuration?.config?.contactEmail&&<p><a href={"mailto:"+configuration.config.contactEmail}>{configuration.config.contactEmail}</a></p>}
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-nav">
        <a href="/" className="site-brand">
          <img src="/brand/dt-monogram.svg" alt="" width="42" height="42" />
          <span>DT Exchange</span>
        </a>
        <nav aria-label="Website navigation">
          <a href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
          <a href="#support">Support</a>
        </nav>
        <a className="site-cta compact" href="/download">
          Download App <ArrowUpRight size={17} />
        </a>
      </header>
      <main id="content">
        <section className="site-hero" id="home">
          <div className="hero-copy">
            <div className="site-eyebrow">
              <span className="status-dot" /> BUILT FOR CLARITY
            </div>
            <h1>
              Sell USDT.
              <br />
              <span>Receive INR.</span>
            </h1>
            <p className="hero-description">
              Your exchange, made simple. A clear path from your USDT wallet to
              your bank account—with a human review at every important step.
            </p>
            {currentRate&&<p className="launch-note">Current admin-set sell rate: ₹{currentRate} / USDT. Confirm the final quote in the app.</p>}
            <div className="hero-actions">
              <a className="site-cta" href="/download">
                <Download size={20} /> Download Android App
              </a>
              <a className="site-text-link" href="#how-it-works">
                See how it works <ArrowRight size={19} />
              </a>
            </div>
            <p className="launch-note">
              <LockKeyhole size={15} /> {androidRelease ? "Verified signed Android release available." : "Signed Android release in preparation. Downloads are not yet available."}
            </p>
            <div className="hero-principles">
              <span>
                <Check size={16} /> TRC20 USDT
              </span>
              <span>
                <Check size={16} /> Reviewed deposits
              </span>
              <span>
                <Check size={16} /> Manual INR payouts
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-note">
              <span className="note-icon">
                <FileCheck2 size={23} />
              </span>
              <div>
                <strong>Reviewed. Then credited.</strong>
                <small>A clear deposit trail</small>
              </div>
            </div>
            <figure className="product-phone">
              <img
                src="/product/home-preview.png"
                alt="DT Exchange Home preview showing the USDT wallet, sample rate, Deposit and Sell actions"
                width="720"
                height="1600"
                fetchPriority="high"
              />
              <figcaption>APP PREVIEW · SAMPLE VALUES</figcaption>
            </figure>
            <div className="floating-pill">
              <span className="status-dot" /> Every step, visible.
            </div>
          </div>
        </section>
        <div className="site-strip">
          <span>One familiar flow.</span>
          <strong>
            USDT wallet <ArrowRight size={18} /> Reviewed deposit{" "}
            <ArrowRight size={18} /> INR bank payout
          </strong>
          <span>Powered by clear records, not promises.</span>
        </div>
        <section id="how-it-works" className="site-section">
          <div className="section-heading">
            <div>
              <p className="site-eyebrow">THE JOURNEY</p>
              <h2>
                From deposit to payout.
                <br />
                No missing steps.
              </h2>
            </div>
            <p>
              Manual operations, made easy to follow. Deposits are reviewed
              before credit; INR payouts are sent by an authorized
              administrator.
            </p>
          </div>
          <div className="steps-grid">
            {steps.map(([number, title, description, items]) => (
              <article className="step-card" key={String(number)}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <ol>
                  {(items as string[]).map((item) => (
                    <li key={item}>
                      <Check size={15} />
                      {item}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
        <section id="features" className="site-section feature-section">
          <div className="section-heading">
            <div>
              <p className="site-eyebrow">MADE FOR YOUR EVERYDAY</p>
              <h2>
                Everything you need.
                <br />
                Nothing in the way.
              </h2>
            </div>
            <p>
              Wallet, bank details and transaction history in one considered
              Android experience.
            </p>
          </div>
          <div className="features-grid">
            {features.map(([Icon, title, body], i) => (
              <article key={title}>
                <span className={"feature-icon tone-" + (i % 3)}>
                  <Icon size={24} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="security" className="site-section security-section">
          <div>
            <p className="site-eyebrow">DESIGNED AROUND ACCOUNTABILITY</p>
            <h2>
              Clear records.
              <br />
              Controlled actions.
            </h2>
            <p>
              Checks are part of the workflow, from the first transaction
              reference to the final payout receipt.
            </p>
            <div className="security-emblem">
              <ShieldCheck size={60} strokeWidth={1.2} />
              <span>
                Review before credit.
                <br />
                <strong>Evidence before completion.</strong>
              </span>
            </div>
          </div>
          <div className="security-list">
            {[
              [
                LockKeyhole,
                "Private evidence",
                "Deposit proof and payout receipts use authenticated access and encrypted storage.",
              ],
              [
                Fingerprint,
                "Duplicate TxID protection",
                "The same network transaction hash cannot create another deposit credit.",
              ],
              [
                BookOpen,
                "Ledger-based balances",
                "Approved movements are recorded in balanced, append-only journals.",
              ],
              [
                Layers,
                "Permission-controlled operations",
                "Admin actions use role permissions and audit records. Payouts retain a UTR or bank reference.",
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof LockKeyhole;
              return (
                <article key={String(title)}>
                  <I size={22} />
                  <div>
                    <h3>{String(title)}</h3>
                    <p>{String(body)}</p>
                  </div>
                </article>
              );
            })}
            <p className="security-caption">
              Official HTTPS endpoints and operational acceptance are required
              before launch. No external certification is claimed.
            </p>
          </div>
        </section>
        <section id="faq" className="site-section faq-section">
          <div>
            <p className="site-eyebrow">GOOD TO KNOW</p>
            <h2>A little more clarity.</h2>
            <p>Answers before your first exchange.</p>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="support" className="site-section">
          <div className="support-panel">
            <div>
              <MessageCircle size={32} />
              <h2>A question about your transaction?</h2>
              <p>
                Need help? Contact DT Exchange Support on Telegram. You can also open Support in the app and include your order reference. Keep
                passwords, OTPs and private keys out of support messages.
              </p>
            </div>
            <a href={"https://t.me/"+telegram} target="_blank" rel="noopener noreferrer" className="site-text-link" aria-label="DT Exchange Support on Telegram, @dtexchange (opens a new tab)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 18.2 20c-.2 1.1-.9 1.4-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.7 13.7.8 12.2c-1-.3-1-1 .2-1.5L20.2 3c.9-.3 1.6.2 1.2.6Z" /></svg>
              Telegram Support @{telegram}
            </a>
          </div>
        </section>
        <section className="site-section download-band">
          <div>
            <p className="site-eyebrow">YOUR NEXT EXCHANGE</p>
            <h2>Built for your pocket.</h2>
            <p>
              The DT Exchange Android release is on its way. Find signed release
              details and installation instructions on the official download
              page.
            </p>
            <a href="/download" className="site-cta">
              <Smartphone size={20} /> Explore Android App{" "}
              <ArrowUpRight size={20} />
            </a>
          </div>
          <img
            src="/brand/dt-monogram.svg"
            width="190"
            height="190"
            alt="DT Exchange logo"
          />
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <a className="site-brand" href="/">
            <img src="/brand/dt-monogram.svg" width="36" height="36" alt="" />
            <span>DT Exchange</span>
          </a>
          <p>Sell USDT. Receive INR.</p>
        </div>
        <div>
          <a href="#how-it-works">How It Works</a>
          <a href="#security">Security</a>
          <a href="/download">Download App</a>
          <a href="/legal/privacy">Privacy Policy</a>
          <a href="/legal/terms">Terms &amp; Conditions</a>
          <a href={"https://t.me/"+telegram} target="_blank" rel="noopener noreferrer" className="site-text-link" aria-label="DT Exchange Support on Telegram, @dtexchange (opens a new tab)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 18.2 20c-.2 1.1-.9 1.4-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.7 13.7.8 12.2c-1-.3-1-1 .2-1.5L20.2 3c.9-.3 1.6.2 1.2.6Z" /></svg>
              Telegram Support @{telegram}
            </a>
        </div>
        <p className="footer-note">
          Release preparation · No public transactions are enabled. Approved
          terms, privacy information and operating review are required before
          service launch. Screenshots show preview data, not live rates or
          balances.
        </p>
      </footer>
    </div>
  );
}
