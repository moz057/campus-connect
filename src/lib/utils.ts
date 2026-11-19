import type { CampusEvent } from "./types";
export const campusZone = "Asia/Manila";
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) =>
  new Intl.DateTimeFormat("en-US", { timeZone: campusZone, ...options }).format(
    new Date(value),
  );
export const timeLabel = (value: string) =>
  dateLabel(value, { hour: "numeric", minute: "2-digit" });
export const isClosed = (e: CampusEvent) =>
  Boolean(e.cancelled_at) ||
  new Date(e.registration_deadline).getTime() <= Date.now();
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
export function validateEvent(e: Partial<CampusEvent>): string | null {
  if (!e.title || e.title.trim().length < 3)
    return "Enter an event title with at least 3 characters.";
  if (!e.description || e.description.trim().length < 10)
    return "Describe the event in at least 10 characters.";
  if (!e.venue?.trim() || !e.organization?.trim())
    return "Venue and organizing group are required.";
  if (
    !e.start_time ||
    !e.end_time ||
    !e.registration_deadline ||
    !Number.isFinite(Date.parse(e.start_time)) ||
    !Number.isFinite(Date.parse(e.end_time)) ||
    !Number.isFinite(Date.parse(e.registration_deadline))
  )
    return "Enter valid event dates and times.";
  if (!e.id && new Date(e.start_time).getTime() <= Date.now())
    return "The event must start in the future.";
  if (new Date(e.end_time) <= new Date(e.start_time))
    return "End time must be after start time.";
  if (new Date(e.registration_deadline) > new Date(e.start_time))
    return "Registration must close before the event starts.";
  if (
    !Number.isInteger(e.capacity) ||
    (e.capacity ?? 0) < 1 ||
    (e.capacity ?? 0) > 100000
  )
    return "Capacity must be a whole number between 1 and 100,000.";
  return null;
}
// Spreadsheet formula injection is neutralized for names/titles supplied by users.
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function downloadCSV(name: string, rows: unknown[][]) {
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function localInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
