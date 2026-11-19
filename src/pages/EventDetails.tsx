import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  Clock3,
  ArrowUpRight,
  Check,
  Share2,
  Pencil,
  Trash2,
  Ticket as TicketIcon,
  GraduationCap,
  Bell,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useOrganizations } from "../contexts/OrganizationContext";
import { useToast } from "../contexts/ToastContext";
import {
  dateLabel,
  timeLabel,
  isClosed,
  parseRegistrationFormUrl,
} from "../lib/utils";
import { Empty, Loading } from "../components/Common";
import Ticket from "../components/Ticket";
export default function EventDetails() {
  const { id } = useParams();
  const { state } = useLocation();
  const listSearch = (state as { eventListSearch?: string } | null)
    ?.eventListSearch;
  const backToEvents = {
    pathname: "/events",
    search:
      typeof listSearch === "string"
        ? new URLSearchParams(listSearch).toString()
        : "",
  };
  const {
    events,
    registrations,
    loading,
    register,
    cancel,
    deleteEvent,
    announcements,
  } = useData();
  const { profile, demo } = useAuth();
  const { canManage, setScope } = useOrganizations();
  const notify = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState(false);
  const [confirmedForm, setConfirmedForm] = useState<{
    eventId: string;
    url: string;
  }>();
  const e = events.find((e) => e.id === id);
  if (loading) return <Loading />;
  if (!e)
    return (
      <Empty
        title="Event not found"
        body="This event may have been removed."
        action={
          <Link className="button primary" to={backToEvents}>
            Browse events
          </Link>
        }
      />
    );
  const registration = registrations.find(
      (r) =>
        r.event_id === id &&
        r.user_id === profile?.id &&
        r.status !== "cancelled",
    ),
    full = (e.filled || 0) >= e.capacity,
    closed = isClosed(e);
  const showsDemoRegistrationNote = demo && !registration && !closed;
  const formUrl = parseRegistrationFormUrl(e.registration_form_url);
  const formConfirmed =
    confirmedForm?.eventId === e.id &&
    confirmedForm.url === e.registration_form_url;
  const soon =
    new Date(e.start_time).getTime() - Date.now() < 86400000 &&
    new Date(e.end_time).getTime() > Date.now();
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      notify(message);
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to={backToEvents} className="back-link">
        <ArrowLeft size={16} />
        Back to events
      </Link>
      <div className="detail-banner">
        <img src={e.banner_url || "/images/campus.jpg"} alt="" />
        <div />
        <span
          className={
            "category-badge category-" + e.category.split(" ")[0].toLowerCase()
          }
        >
          {e.category}
        </span>
      </div>
      <div className="detail-layout">
        <header className="detail-heading">
          <span className="eyebrow">{e.organization}</span>
          <h1>{e.title}</h1>
          <div className="detail-summary">
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              <time dateTime={e.start_time}>
                {dateLabel(e.start_time, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                PHT
              </time>
            </span>
            <span>
              <MapPin size={16} aria-hidden="true" /> {e.venue}
            </span>
          </div>
        </header>
        <aside>
          <div className="registration-panel panel">
            <h2>Registration</h2>
            <div className="free-tag">
              Free admission <span>For USC students</span>
            </div>
            <div className="registration-progress">
              <div
                style={{
                  width:
                    Math.min(100, ((e.filled || 0) / e.capacity) * 100) + "%",
                }}
              />
            </div>
            <div className="capacity-line">
              <Users size={16} />
              <strong>
                {e.filled || 0} / {e.capacity}
              </strong>{" "}
              slots filled
            </div>
            {formUrl && !e.cancelled_at && (
              <div className="event-registration-form">
                <a
                  className="button full-width"
                  href={formUrl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open {e.registration_form_required ? "required" : "optional"}{" "}
                  form
                  <ArrowUpRight size={17} />
                </a>
                {e.registration_form_required &&
                  !registration &&
                  !closed &&
                  (profile ? (
                    <label className="form-confirmation">
                      <input
                        type="checkbox"
                        checked={formConfirmed}
                        onChange={(event) =>
                          setConfirmedForm(
                            event.target.checked
                              ? { eventId: e.id, url: e.registration_form_url! }
                              : undefined,
                          )
                        }
                      />
                      I submitted the event form
                    </label>
                  ) : (
                    <p className="muted small-copy">
                      Sign in to confirm you submitted the form and register.
                    </p>
                  ))}
              </div>
            )}
            {e.cancelled_at ? (
              <p className="error-message">This event has been cancelled.</p>
            ) : registration ? (
              <>
                <div className="registration-success">
                  <Check size={18} />
                  {registration.status === "waitlisted"
                    ? "You’re on the waitlist."
                    : "You’re on the list!"}
                </div>
                {registration.status === "registered" ? (
                  <button
                    className="button primary full-width"
                    onClick={() => setTicket(true)}
                  >
                    <TicketIcon size={17} />
                    View my QR ticket
                  </button>
                ) : (
                  <p className="muted small-copy">
                    If a spot opens before the deadline, your ticket appears
                    here automatically. Check your registrations for updates.
                  </p>
                )}
                <button
                  disabled={
                    busy || new Date(e.start_time).getTime() <= Date.now()
                  }
                  className="button subtle full-width"
                  onClick={() => {
                    if (
                      window.confirm("Cancel your registration for this event?")
                    )
                      void act(
                        () => cancel(e!.id),
                        "Your registration has been cancelled.",
                      );
                  }}
                >
                  Cancel registration
                </button>
              </>
            ) : (
              <>
                {showsDemoRegistrationNote && (
                  <p
                    className="demo-registration-note"
                    id="demo-registration-note"
                  >
                    Demo mode. Registrations are saved only in this browser.
                  </p>
                )}
                <button
                  aria-describedby={
                    showsDemoRegistrationNote
                      ? "demo-registration-note"
                      : undefined
                  }
                  disabled={
                    busy ||
                    closed ||
                    Boolean(
                      profile && e.registration_form_required && !formConfirmed,
                    )
                  }
                  className="button primary full-width"
                  onClick={() => {
                    if (!profile) {
                      navigate("/login", { state: { from: "/events/" + id } });
                      return;
                    }
                    void act(
                      () =>
                        register(
                          e.id,
                          full,
                          formConfirmed ? confirmedForm.url : undefined,
                        ),
                      full
                        ? "You’re on the waitlist."
                        : "You’re registered! Your QR ticket is ready.",
                    );
                  }}
                >
                  {busy
                    ? "Saving…"
                    : closed
                      ? "Registration closed"
                      : full
                        ? "Join the waitlist"
                        : "Register for event"}
                  {!closed && <ArrowUpRight size={17} />}
                </button>
              </>
            )}
            <p className="registration-deadline">
              <Clock3 size={14} />
              Registration closes {dateLabel(e.registration_deadline)} at{" "}
              {timeLabel(e.registration_deadline)}
            </p>
            <div className="registration-note">
              One account. One spot. A whole lot to experience.
            </div>
            <button
              className="button subtle full-width"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  notify("Event link copied. Share it with your friends!");
                } catch {
                  notify(
                    "Copy the address from your browser to share this event.",
                    true,
                  );
                }
              }}
            >
              <Share2 size={15} />
              Share this event
            </button>
            {profile && canManage(e.organization_id) && (
              <div className="admin-event-actions">
                <Link
                  className="button full-width"
                  to={"/admin/events/" + id + "/edit"}
                >
                  <Pencil size={14} />
                  Edit event
                </Link>
                <Link
                  className="text-link"
                  to={"/admin/attendance?event=" + id}
                  onClick={() => setScope(e.organization_id ?? "")}
                >
                  Manage attendance <ArrowUpRight size={14} />
                </Link>
                <button
                  disabled={busy}
                  className="danger-link"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this event and all its registrations, attendance, and event announcements? This cannot be undone.",
                      )
                    )
                      void act(async () => {
                        await deleteEvent(e.id);
                        navigate("/events");
                      }, "Event deleted.");
                  }}
                >
                  <Trash2 size={14} />
                  Delete event
                </button>
              </div>
            )}
          </div>
        </aside>
        <div className="detail-main">
          {soon && (
            <div className="soon-banner">
              <Bell size={18} />
              <div>
                <strong>This event is starting soon!</strong>
                <p>
                  Have your QR ticket ready and allow a little extra time for
                  check-in.
                </p>
              </div>
            </div>
          )}
          <section
            className="detail-section"
            aria-labelledby="event-details-heading"
          >
            <h2 id="event-details-heading">Event details</h2>
            <dl className="event-facts">
              <div>
                <dt>
                  <CalendarDays size={16} aria-hidden="true" /> Starts
                </dt>
                <dd>
                  <time dateTime={e.start_time}>
                    {dateLabel(e.start_time, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    PHT
                  </time>
                </dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={16} aria-hidden="true" /> Ends
                </dt>
                <dd>
                  <time dateTime={e.end_time}>
                    {dateLabel(e.end_time, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    PHT
                  </time>
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={16} aria-hidden="true" /> Venue
                </dt>
                <dd>{e.venue}</dd>
              </div>
              <div>
                <dt>
                  <GraduationCap size={16} aria-hidden="true" /> Hosted by
                </dt>
                <dd>
                  {e.organization_id ? (
                    <Link
                      className="text-link"
                      to={"/organizations/" + e.organization_id}
                    >
                      {e.organization}
                    </Link>
                  ) : (
                    e.organization
                  )}
                </dd>
              </div>
            </dl>
            <p className="preserve-lines">{e.description}</p>
          </section>
          {announcements.filter((a) => a.event_id === id).length > 0 && (
            <section className="detail-section">
              <h2>Event updates</h2>
              {announcements
                .filter((a) => a.event_id === id)
                .map((a) => (
                  <div className="panel announcement" key={a.id}>
                    <h3>{a.title}</h3>
                    <p>{a.body}</p>
                  </div>
                ))}
            </section>
          )}
        </div>
      </div>
      {ticket && registration && !e.cancelled_at && (
        <Ticket
          event={e}
          registration={registration}
          onClose={() => setTicket(false)}
        />
      )}
    </>
  );
}
