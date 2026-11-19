import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Ticket as TicketIcon,
  ArrowUpRight,
  MapPin,
  CalendarDays,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { dateLabel, timeLabel } from "../lib/utils";
import { Empty, Loading, PageTitle } from "../components/Common";
import Ticket from "../components/Ticket";
export default function Registrations() {
  const { profile } = useAuth();
  const { registrations, events, attendance, loading } = useData();
  const [tab, setTab] = useState("upcoming");
  const [selected, setSelected] = useState("");
  const own = registrations.filter((r) => r.user_id === profile?.id);
  const visible = own.filter((r) => {
    const e = events.find((e) => e.id === r.event_id);
    if (!e) return false;
    const cancelled = Boolean(e.cancelled_at) || r.status === "cancelled";
    if (cancelled || tab === "cancelled")
      return cancelled && tab === "cancelled";
    return tab === "waitlisted"
      ? r.status === "waitlisted"
      : r.status === "registered" &&
          (tab === "upcoming"
            ? new Date(e.end_time).getTime() >= Date.now()
            : new Date(e.end_time).getTime() < Date.now());
  });
  const selectedReg = own.find((r) => r.id === selected),
    selectedEvent = events.find((e) => e.id === selectedReg?.event_id);
  return (
    <>
      <PageTitle
        eyebrow="YOUR CAMPUS PLANS"
        title="My registrations"
        description="Your next experiences, all in one place. Keep your QR ticket handy."
        action={
          <Link className="button primary" to="/events">
            Find an event <ArrowUpRight size={16} />
          </Link>
        }
      />
      <div className="page-tabs">
        {["upcoming", "past", "waitlisted", "cancelled"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "cancelled"
              ? "Cancelled"
              : t === "waitlisted"
                ? "Waitlisted"
                : t === "past"
                  ? "Past events"
                  : "Upcoming events"}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : visible.length ? (
        <div className="registration-list">
          {visible.map((r) => {
            const e = events.find((e) => e.id === r.event_id)!;
            const checked = attendance.find((a) => a.registration_id === r.id);
            const cancelled =
              Boolean(e.cancelled_at) || r.status === "cancelled";
            const soon =
              !cancelled &&
              new Date(e.start_time).getTime() - Date.now() < 86400000 &&
              new Date(e.end_time).getTime() > Date.now();
            return (
              <article className="registration-item panel" key={r.id}>
                <img src={e.banner_url || "/images/campus.jpg"} alt="" />
                <div className="registration-item-content">
                  <span className="eyebrow">{e.category}</span>
                  <Link to={"/events/" + e.id}>
                    <h2>{e.title}</h2>
                  </Link>
                  <p>
                    <CalendarDays size={15} />
                    {dateLabel(e.start_time)} · {timeLabel(e.start_time)}
                    <span className="desktop-break">PHT</span>
                  </p>
                  <p>
                    <MapPin size={15} />
                    {e.venue}
                  </p>
                  {soon && (
                    <div className="soon-badge">
                      <Clock3 size={13} />
                      Starting soon · Have your ticket ready
                    </div>
                  )}
                  {checked && (
                    <span className="success-badge">
                      <CheckCircle2 size={13} />
                      Checked in at {timeLabel(checked.checked_in_at)}
                    </span>
                  )}
                </div>
                <div className="registration-item-action">
                  <span
                    className={
                      cancelled || r.status === "waitlisted"
                        ? "waitlist-badge"
                        : "success-badge"
                    }
                  >
                    {cancelled
                      ? e.cancelled_at
                        ? "Event cancelled"
                        : "Registration cancelled"
                      : r.status === "waitlisted"
                        ? "On the waitlist"
                        : "Confirmed"}
                  </span>
                  {!cancelled &&
                    (r.status === "registered" ? (
                      <button
                        className="button primary"
                        onClick={() => setSelected(r.id)}
                      >
                        <TicketIcon size={16} />
                        View QR ticket
                      </button>
                    ) : (
                      <p className="muted small-copy">
                        We’ll promote your registration when a spot opens.
                      </p>
                    ))}
                  <Link to={"/events/" + e.id} className="text-link">
                    Event details <ArrowUpRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            tab === "waitlisted"
              ? "No waitlisted events"
              : "Your next experience is waiting"
          }
          body={
            tab === "past"
              ? "Your completed events will appear here."
              : "Explore campus events and register for something that interests you."
          }
          action={
            <Link to="/events" className="button primary">
              Discover events <ArrowUpRight size={16} />
            </Link>
          }
        />
      )}{" "}
      {selectedReg?.status === "registered" &&
        selectedEvent &&
        !selectedEvent.cancelled_at && (
          <Ticket
            event={selectedEvent}
            registration={selectedReg}
            onClose={() => setSelected("")}
          />
        )}
    </>
  );
}
