import { LoaderCircle, CalendarDays, SearchX } from "lucide-react";
import type { ReactNode } from "react";
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>Getting everything ready…</p>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  body = "Check back soon for more campus moments.",
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <SearchX size={28} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function DateTile({ value }: { value: string }) {
  const d = new Date(value);
  return (
    <div className="date-tile">
      <span>
        {new Intl.DateTimeFormat("en", {
          month: "short",
          timeZone: "Asia/Manila",
        }).format(d)}
      </span>
      <strong>
        {new Intl.DateTimeFormat("en", {
          day: "numeric",
          timeZone: "Asia/Manila",
        }).format(d)}
      </strong>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error-message" role="alert">
      {message}
    </div>
  ) : null;
}
export function CalendarIcon() {
  return <CalendarDays size={19} />;
}
