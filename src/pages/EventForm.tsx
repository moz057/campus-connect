import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Save, ArrowUpRight } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useOrganizations } from "../contexts/OrganizationContext";
import { useToast } from "../contexts/ToastContext";
import { categories } from "../lib/types";
import { localInput, validateEvent } from "../lib/utils";
import { uploadImage } from "../lib/upload";
import {
  PageTitle,
  Field,
  ErrorMessage,
  Empty,
  Loading,
} from "../components/Common";
function EventEditor() {
  const { id } = useParams();
  const { events, saveEvent } = useData();
  const { profile } = useAuth();
  const { organizations, manageable, scope, canManage } = useOrganizations();
  const notify = useToast(),
    navigate = useNavigate();
  const existing = events.find((e) => e.id === id);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [form, setForm] = useState({
    title: existing?.title || "",
    description: existing?.description || "",
    category: existing?.category || "Academic",
    organization_id: existing
      ? (existing.organization_id ?? "")
      : manageable.some((org) => org.id === scope)
        ? scope
        : "",
    venue: existing?.venue || "",
    banner_url: existing?.banner_url || "",
    capacity: existing?.capacity || 100,
    registration_form_url: existing?.registration_form_url ?? "",
    registration_form_required: existing?.registration_form_required ?? false,
    start_time: localInput(existing?.start_time || tomorrow.toISOString()),
    end_time: localInput(
      existing?.end_time ||
        new Date(tomorrow.getTime() + 7200000).toISOString(),
    ),
    registration_deadline: localInput(
      existing?.registration_deadline ||
        new Date(tomorrow.getTime() - 3600000).toISOString(),
    ),
  });
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const set = (key: string, value: string | number) =>
    setForm((s) => ({ ...s, [key]: value }));
  if (id && (!existing || !canManage(existing.organization_id)))
    return (
      <Empty title="Event not found" body="This event may have been deleted." />
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const organization = organizations.find(
      (item) => item.id === form.organization_id,
    );
    const event = {
      ...form,
      id,
      title: form.title.trim(),
      description: form.description.trim(),
      organization_id: form.organization_id || null,
      organization:
        organization?.name ??
        (existing && !existing.organization_id
          ? existing.organization
          : "University of San Carlos"),
      venue: form.venue.trim(),
      registration_form_url: form.registration_form_url.trim() || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      registration_deadline: new Date(form.registration_deadline).toISOString(),
    };
    const invalid = validateEvent(event);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const eventId = await saveEvent(event);
      notify(
        id
          ? "Event updated."
          : "Your event is live. Let’s bring people together!",
      );
      navigate("/events/" + eventId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={id ? "/events/" + id : "/admin"}>
        <ArrowLeft size={16} />
        Back to {id ? "event" : "dashboard"}
      </Link>
      <PageTitle
        eyebrow="CREATE A CAMPUS MOMENT"
        title={
          id ? "Give your event an update." : "Good things start with an idea."
        }
        description={
          id
            ? "Keep your community in the know with the latest details."
            : "Tell the campus what’s happening. We’ll help bring everyone together."
        }
      />
      <form className="event-form" onSubmit={submit}>
        <ErrorMessage message={error} />
        <div className="event-form-layout">
          <div>
            <section className="panel form-panel">
              <div className="form-step">
                <span>01</span>
                <div>
                  <h2>The big picture</h2>
                  <p>What should your fellow Carolinians know?</p>
                </div>
              </div>
              <Field label="Event title">
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Give your event a great name"
                />
              </Field>
              <Field label="Description">
                <textarea
                  required
                  minLength={10}
                  maxLength={10000}
                  rows={6}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What’s happening, who’s it for, and why should they be there?"
                />
              </Field>
              <div className="form-grid">
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Organizing group">
                  <select
                    required={profile?.role !== "admin"}
                    disabled={Boolean(id) && profile?.role !== "admin"}
                    value={form.organization_id}
                    onChange={(e) => set("organization_id", e.target.value)}
                  >
                    {profile?.role === "admin" && (
                      <option value="">
                        {existing && !existing.organization_id
                          ? existing.organization + " (unassigned)"
                          : "University of San Carlos"}
                      </option>
                    )}
                    {manageable.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    {existing?.organization_id &&
                      !manageable.some(
                        (o) => o.id === existing.organization_id,
                      ) && (
                        <option value={existing.organization_id}>
                          {existing.organization} (archived)
                        </option>
                      )}
                  </select>
                </Field>
              </div>
            </section>
            <section className="panel form-panel">
              <div className="form-step">
                <span>02</span>
                <div>
                  <h2>A time and a place</h2>
                  <p>Let’s put it on the calendar.</p>
                </div>
              </div>
              <p className="calendar-timezone">
                Enter dates in your device’s local timezone (
                {Intl.DateTimeFormat().resolvedOptions().timeZone}). Tickets
                display Philippine Time.
              </p>
              <div className="form-grid">
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    required
                    value={form.start_time}
                    onChange={(e) => set("start_time", e.target.value)}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    required
                    value={form.end_time}
                    onChange={(e) => set("end_time", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Venue">
                <input
                  required
                  maxLength={240}
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
                  placeholder="e.g. SAFAD Theater, Talamban Campus"
                />
              </Field>
            </section>
            <section className="panel form-panel">
              <div className="form-step">
                <span>03</span>
                <div>
                  <h2>Room for your community</h2>
                  <p>Set your registration details.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field
                  label="Registration limit"
                  hint="Confirmed registrations can’t exceed this limit."
                >
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    required
                    value={form.capacity}
                    onChange={(e) => set("capacity", Number(e.target.value))}
                  />
                </Field>
                <Field
                  label="Registration deadline"
                  hint="Must be at or before the event starts."
                >
                  <input
                    type="datetime-local"
                    required
                    value={form.registration_deadline}
                    onChange={(e) =>
                      set("registration_deadline", e.target.value)
                    }
                  />
                </Field>
              </div>
              <Field
                label="Registration form link (optional)"
                hint="Paste the link students use to fill out your Google Form or other external form."
              >
                <input
                  type="url"
                  maxLength={2048}
                  value={form.registration_form_url}
                  onChange={(e) => {
                    const link = e.target.value;
                    setForm((current) => ({
                      ...current,
                      registration_form_url: link,
                      registration_form_required:
                        Boolean(link.trim()) &&
                        current.registration_form_required,
                    }));
                  }}
                  placeholder="https://forms.gle/..."
                />
              </Field>
              <label className="form-confirmation">
                <input
                  type="checkbox"
                  checked={form.registration_form_required}
                  disabled={!form.registration_form_url.trim()}
                  onChange={(e) => {
                    const required = e.target.checked;
                    setForm((current) => ({
                      ...current,
                      registration_form_required: required,
                    }));
                  }}
                />
                Require students to confirm they submitted the form
              </label>
              <div className="info-note">
                When the event fills up, students can join a waitlist. Cancelled
                spots go to the next student in line before the deadline.
              </div>
            </section>
          </div>
          <aside>
            <section className="panel form-panel">
              <div className="form-step">
                <span>
                  <ImagePlus size={18} />
                </span>
                <div>
                  <h2>Set the scene</h2>
                  <p>Add your event banner.</p>
                </div>
              </div>
              <div className="banner-preview">
                {form.banner_url ? (
                  <img
                    src={form.banner_url}
                    alt="Event banner preview"
                    onError={(e) => {
                      e.currentTarget.src = "/images/campus.jpg";
                    }}
                  />
                ) : (
                  <>
                    <ImagePlus size={36} />
                    <p>Your event’s first impression</p>
                  </>
                )}
              </div>
              <Field
                label="Upload an image"
                hint="JPG, PNG, WebP · Up to 5 MB (500 KB in demo)"
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploading(true);
                    try {
                      set(
                        "banner_url",
                        await uploadImage(f, "event-banners", profile!.id),
                      );
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </Field>
              <Field label="Or use an image URL">
                <input
                  type="url"
                  value={
                    form.banner_url.startsWith("data:") ? "" : form.banner_url
                  }
                  onChange={(e) => set("banner_url", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <small className="muted">
                An image of your activity or campus works great. Use an image
                you have permission to share.
              </small>
            </section>
            <div className="publish-note">
              <h3>A little checklist</h3>
              <p>
                Clear title. The right date. A welcoming description. You’re
                ready to make something happen.
              </p>
              <button
                className="button primary full-width"
                disabled={busy || uploading}
              >
                {id ? <Save size={16} /> : <ArrowUpRight size={16} />}{" "}
                {uploading
                  ? "Uploading…"
                  : busy
                    ? "Saving…"
                    : id
                      ? "Save event"
                      : "Publish event"}
              </button>
              <Link
                className="button subtle full-width"
                to={id ? "/events/" + id : "/admin"}
              >
                Cancel
              </Link>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}

export default function EventForm() {
  const { loading } = useData();
  return loading ? <Loading /> : <EventEditor />;
}
