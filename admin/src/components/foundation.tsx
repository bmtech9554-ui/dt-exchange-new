"use client";
import { useState } from "react";
import {
  Home,
  Wallet,
  History,
  UserRound,
  Gift,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  Headphones,
  ChevronRight,
  Check,
  Copy,
  Layers3,
  ArrowRight,
  ShieldCheck,
  Orbit,
} from "lucide-react";
import { Badge, Button, Card, Field, Status, StepProgress } from "./ui";
const tabs = [
  { label: "Home", icon: Home },
  { label: "Wallet", icon: Wallet },
  { label: "History", icon: History },
  { label: "Profile", icon: UserRound },
];
export function Foundation() {
  const [tab, setTab] = useState("Home");
  const [copied, setCopied] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [step, setStep] = useState(0);
  async function copy() {
    try {
      await navigator.clipboard.writeText("DT Exchange");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE DT EXCHANGE FOUNDATION</div>
          <h1>Clarity, in every exchange.</h1>
          <p>A considered system for a simpler way to move money.</p>
        </div>
        <Badge tone="blue">
          <Layers3 size={13} />
          Phase 01 / 08
        </Badge>
      </div>
      <div className="foundation-grid">
        <div className="foundation-left">
          <Card className="brand-hero">
            <div className="hero-text">
              <Badge>
                <span className="tiny-dot" />
                THE START OF SOMETHING SIMPLE
              </Badge>
              <h2>
                Sell USDT.
                <br />
                <span>Receive INR.</span>
              </h2>
              <p>
                Clear numbers. Calm interactions.
                <br />
                One unmistakable DT Exchange experience.
              </p>
              <div className="hero-divider" />
              <div className="hero-bottom">
                <span>
                  <ShieldCheck size={17} /> Designed around trust
                </span>
                <span>01 — Identity</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-a" />
              <div className="orbit orbit-b" />
              <div className="logo-tile">
                <img
                  src="/brand/dt-monogram.svg"
                  width="116"
                  height="116"
                  alt=""
                />
              </div>
              <span className="art-spark spark-a" />
              <span className="art-spark spark-b" />
              <span className="art-bubble" />
            </div>
          </Card>
          <Card className="palette-card">
            <div className="section-heading">
              <div>
                <span className="section-number">02</span>
                <h3>A lighter palette</h3>
              </div>
              <small>Light mode, always</small>
            </div>
            <div className="palette">
              {[
                ["White", "#FFFFFF"],
                ["Mint", "#20DDA5"],
                ["Teal", "#18C7BA"],
                ["Soft blue", "#EDF4FF"],
                ["Navy", "#081B3A"],
              ].map(([label, hex]) => (
                <div key={label}>
                  <span className="swatch" style={{ background: hex }} />
                  <strong>{label}</strong>
                  <small>{hex}</small>
                </div>
              ))}
            </div>
          </Card>
          <div className="component-grid">
            <Card>
              <div className="section-heading">
                <div>
                  <span className="section-number">03</span>
                  <h3>Made to feel effortless</h3>
                </div>
              </div>
              <div className="button-demo">
                <Button onClick={() => setPressed(!pressed)}>
                  {pressed ? (
                    <>
                      <Check size={18} />
                      Interaction ready
                    </>
                  ) : (
                    <>
                      Primary action
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={copy}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                  {copied ? "Copied" : "Copy brand name"}
                </Button>
              </div>
              <div className="badge-row">
                <Badge tone="mint">Active</Badge>
                <Status state="processing" />
              </div>
              <p className="component-note">
                Soft surfaces. Clear states. A little motion.
              </p>
            </Card>
            <Card>
              <div className="section-heading">
                <div>
                  <span className="section-number">04</span>
                  <h3>Room to breathe</h3>
                </div>
              </div>
              <Field
                label="Amount field"
                placeholder="0.00"
                inputMode="decimal"
                hint="Component preview · no transaction"
              />
              <div className="type-specimen">
                <span>Aa</span>
                <div>
                  Inter / System
                  <small>Clear, readable, quietly confident.</small>
                </div>
              </div>
            </Card>
          </div>
          <Card className="steps-card">
            <div className="section-heading">
              <div>
                <span className="section-number">05</span>
                <h3>Every step, clear</h3>
              </div>
              <button
                className="text-button"
                onClick={() => setStep((step + 1) % 4)}
              >
                Preview motion <ArrowRight size={15} />
              </button>
            </div>
            <StepProgress
              steps={["Amount", "Confirm", "Send", "Track"]}
              active={step}
            />
          </Card>
        </div>
        <aside className="mobile-preview">
          <div className="phone-caption">
            <span>MOBILE FOUNDATION</span>
            <span>4 tabs. Zero clutter.</span>
          </div>
          <div className="phone">
            <div className="phone-status">
              <span>9:41</span>
              <span aria-hidden="true">● ● ▰</span>
            </div>
            <div className="phone-content">
              <div className="phone-brand">
                <img
                  src="/brand/dt-monogram.svg"
                  width="41"
                  height="41"
                  alt="DT Exchange"
                />
                <span>DT Exchange</span>
                <span className="phone-avatar">DT</span>
              </div>
              <div className="phone-page-key">{tab.toUpperCase()}</div>
              <h2>
                {
                  {
                    Home: "A fresh start.",
                    Wallet: "Your money, clearly.",
                    History: "Every move, in view.",
                    Profile: "Simply you.",
                  }[tab]
                }
              </h2>
              <p className="phone-intro">Sell USDT. Receive INR.</p>
              {tab === "Profile" ? (
                <>
                  <div className="phone-profile-card">
                    <span className="avatar">DT</span>
                    <strong>User Details</strong>
                    <p>Name and email appear after sign-in.</p>
                  </div>
                  <div className="phone-profile-menu">
                    {[
                      {
                        label: "Bank Accounts",
                        description: "Manage your payout methods",
                        icon: Landmark,
                      },
                      {
                        label: "Referral Program",
                        description: "Earn by inviting friends",
                        icon: Gift,
                      },
                      {
                        label: "Settings",
                        description: "Password, security & more",
                        icon: Settings,
                      },
                    ].map((x) => (
                      <div key={x.label}>
                        <x.icon size={18} />
                        <span>
                          <strong>{x.label}</strong>
                          <small>{x.description}</small>
                        </span>
                        <ChevronRight size={16} />
                      </div>
                    ))}
                  </div>
                  <button className="phone-logout" disabled>
                    <LogOut size={16} />
                    Logout
                  </button>
                  <p className="phone-version">DT Exchange v1.0</p>
                </>
              ) : tab === "History" ? (
                <div className="phone-history-empty">
                  <History size={27} />
                  <strong>Every move, in view.</strong>
                  <p>Activity appears after your first transaction.</p>
                </div>
              ) : (
                <>
                  <div className="phone-balance">
                    <div className="phone-balance-top">
                      <span>Balance component</span>
                      <Wallet size={16} />
                    </div>
                    <strong>
                      — <small>USDT</small>
                    </strong>
                    <span className="muted">Your balance will appear here</span>
                    <div className="phone-actions">
                      <button disabled>
                        <ArrowDownLeft size={16} />
                        Deposit
                      </button>
                      <button disabled className="sell">
                        <ArrowUpRight size={16} />
                        Sell
                      </button>
                    </div>
                  </div>
                  <div className="phone-quick">
                    {[
                      { label: "Deposit", icon: ArrowDownLeft },
                      { label: "Sell", icon: ArrowUpRight },
                      { label: "Bank", icon: Landmark },
                      { label: "Support", icon: Headphones },
                    ].map((x) => (
                      <div key={x.label}>
                        <span>
                          <x.icon size={21} strokeWidth={1.6} />
                        </span>
                        <small>{x.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="phone-inset">
                    <span className="inset-icon">
                      <Orbit size={23} />
                    </span>
                    <div>
                      <strong>Built around you.</strong>
                      <p>One clear step at a time.</p>
                    </div>
                    <ChevronRight size={17} />
                  </div>
                  <div className="phone-section-title">
                    <strong>Activity</strong>
                    <span>View all</span>
                  </div>
                  <div className="phone-empty">
                    <div className="empty-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                    <p>Your next chapter starts here.</p>
                    <small>
                      Activity appears after your first transaction.
                    </small>
                  </div>
                </>
              )}
            </div>
            <nav className="phone-nav" aria-label="Mobile navigation preview">
              {tabs.map((x) => (
                <button
                  key={x.label}
                  onClick={() => setTab(x.label)}
                  aria-current={tab === x.label ? "page" : undefined}
                  className={tab === x.label ? "active" : ""}
                >
                  <x.icon size={20} strokeWidth={1.7} />
                  <span>{x.label}</span>
                </button>
              ))}
            </nav>
            <div className="phone-home-indicator" />
          </div>
          <p className="preview-disclosure">
            Interactive component preview.
            <br />
            Screens and account flows arrive in Phase 2.
          </p>
        </aside>
      </div>
    </>
  );
}
