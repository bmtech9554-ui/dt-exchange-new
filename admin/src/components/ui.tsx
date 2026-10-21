import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { Check, Clock3, TriangleAlert, ArrowUpRight } from "lucide-react";
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button {...props} className={`button ${variant} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: "mint" | "blue" | "neutral" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Skeleton({ width = "100%" }: { width?: string }) {
  return (
    <span
      aria-label="Loading"
      role="status"
      className="skeleton"
      style={{ width }}
    />
  );
}
export function Status({
  state,
}: {
  state: "verified" | "required" | "processing" | "failed";
}) {
  const icons = {
    verified: Check,
    required: TriangleAlert,
    processing: Clock3,
    failed: TriangleAlert,
  };
  const Icon = icons[state];
  return (
    <Badge
      tone={state === "verified" ? "mint" : state === "failed" ? "red" : "blue"}
    >
      <Icon size={13} />
      {
        {
          verified: "Verified",
          required: "Verification Required",
          processing: "Processing",
          failed: "Failed",
        }[state]
      }
    </Badge>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ArrowUpRight size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function StepProgress({
  steps,
  active,
}: {
  steps: readonly string[];
  active: number;
}) {
  return (
    <ol className="step-progress">
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={i === active ? "step" : undefined}
          className={i <= active ? "active" : ""}
        >
          <span>{i < active ? <Check size={14} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
