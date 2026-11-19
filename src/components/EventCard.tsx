import { Link } from "react-router-dom";
import { CalendarDays, MapPin, ArrowUpRight, Users, Check } from "lucide-react";
import type { CampusEvent } from "../lib/types";
import { dateLabel, timeLabel, isClosed } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
export default function EventCard({
  event: e,
  list = false,
}: {
  event: CampusEvent;
  list?: boolean;
}) {
  const { profile } = useAuth();
  const { registrations } = useData();
  const registered = registrations.some(
    (r) =>
      r.event_id === e.id &&
      r.user_id === profile?.id &&
      r.status === "registered",
  );
  const full = (e.filled || 0) >= e.capacity;
  return (
    <article className={"event-card " + (list ? "event-card-list" : "")}>
      <Link to={"/events/" + e.id} className="event-image-link">
        <img
          className="event-image"
          src={e.banner_url || "/images/campus.jpg"}
          alt=""
          loading="lazy"
          onError={(ev) => {
            ev.currentTarget.src = "/images/campus.jpg";
          }}
        />
        <div className="event-image-shade" />
        <span
          className={
            "category-badge category-" + e.category.split(" ")[0].toLowerCase()
          }
        >
          {e.category}
        </span>
        <span className="image-arrow">
          <ArrowUpRight size={18} />
        </span>
        {registered && (
          <span className="registered-overlay">
            <Check size={12} /> You’re registered
          </span>
        )}
      </Link>
      <div className="event-card-content">
        <span className="event-org">{e.organization}</span>
        <Link className="event-title" to={"/events/" + e.id}>
          {e.title}
        </Link>
        <div className="event-card-facts">
          <div className="event-meta">
            <CalendarDays size={16} aria-hidden="true" />
            <span>
              {dateLabel(e.start_time, {
                month: "short",
                day: "numeric",
                weekday: "short",
              })}
              <span className="meta-dot">·</span>
              {timeLabel(e.start_time)}
            </span>
          </div>
          <div className="event-meta">
            <MapPin size={16} aria-hidden="true" />
            <span>{e.venue}</span>
          </div>
        </div>
        <div className="event-card-bottom">
          <span className={"slots " + (full ? "full" : "")}>
            <Users size={16} aria-hidden="true" />
            {e.filled || 0}
            <span>/ {e.capacity} slots filled</span>
          </span>
          <Link to={"/events/" + e.id} className="button event-cta">
            {registered
              ? "View ticket"
              : isClosed(e)
                ? "View event"
                : full
                  ? "Join waitlist"
                  : "View event"}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
