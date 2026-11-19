import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { dateLabel, timeLabel, isClosed } from "../lib/utils";
import { Empty, Loading } from "../components/Common";
import Ticket from "../components/Ticket";
export default function EventDetails() {
  const { id } = useParams();
  const {
    events,
    registrations,
    loading,
    register,
    cancel,
    deleteEvent,
    announcements,
  } = useData();
  const { profile } = useAuth();
  const { canManage, setScope } = useOrganizations();
  const notify = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState(false);
  const e = events.find((e) => e.id === id);
  if (loading) return <Loading />;
  if (!e)
    return (
      <Empty
        title="Event not found"
        body="This event may have been removed."
        action={
          <Link className="button primary" to="/events">
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
      <Link to="/events" className="back-link">
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
        <div className="detail-main">
          <span className="eyebrow">{e.organization}</span>
          <h1>{e.title}</h1>
          <div className="detail-chips">
            <span>
              <CalendarDays size={16} />
              {dateLabel(e.start_time, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>
              <Clock3 size={16} />
              {timeLabel(e.start_time)} – {timeLabel(e.end_time)} PHT
            </span>
          </div>
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
          <section className="detail-section">
            <h2>A little about this event</h2>
            <p className="preserve-lines">{e.description}</p>
          </section>
          <section className="detail-section">
            <h2>Where we’re meeting</h2>
            <div className="venue-box">
              <span className="stat-icon pale-green">
                <MapPin size={24} />
              </span>
              <div>
                <h3>{e.venue}</h3>
                <p>University of San Carlos · Cebu, Philippines</p>
              </div>
            </div>
          </section>
          <section className="detail-section">
            <h2>Your hosts</h2>
            <div className="venue-box">
              <span className="stat-icon pale-gold">
                <GraduationCap size={24} />
              </span>
              <div>
                <h3>{e.organization}</h3>
                <p>Part of the Carolinian community</p>
              </div>
            </div>
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
        <aside>
          <div className="registration-panel panel">
            <span className="eyebrow">SAVE YOUR SPOT</span>
            <h2>
              A campus moment
              <br />
              worth showing up for.
            </h2>
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
              <button
                disabled={busy || closed}
                className="button primary full-width"
                onClick={() => {
                  if (!profile) {
                    navigate("/login", { state: { from: "/events/" + id } });
                    return;
                  }
                  void act(
                    () => register(e.id, full),
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
