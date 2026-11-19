import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Sparkles,
  Users,
  Clock3,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { categories } from "../lib/types";
import { dateLabel, timeLabel, isClosed } from "../lib/utils";
import EventCard from "../components/EventCard";
import { Empty, Loading, DateTile } from "../components/Common";
export default function Discover() {
  const { profile, demo } = useAuth();
  const { events, announcements, loading, error, refresh } = useData();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(false);
  const [view, setView] = useState("grid");
  const [limit, setLimit] = useState(6);
  const searchInput = useRef<HTMLInputElement>(null);
  const q = params.get("q") || "",
    category = params.get("category") || "",
    organization = params.get("organization") || "",
    date = params.get("date") || "",
    availability = params.get("availability") || "";
  const [month, setMonth] = useState(new Date());
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
    setLimit(6);
  }
  function clearFilters() {
    setParams({});
    searchInput.current?.focus();
  }
  useEffect(() => {
    setLimit(6);
  }, [q, category, organization, date, availability]);
  const upcoming = events
    .filter(
      (e) => !e.cancelled_at && new Date(e.end_time).getTime() >= Date.now(),
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const filtered = useMemo(
    () =>
      upcoming.filter(
        (e) =>
          (!q ||
            (e.title + " " + e.description + " " + e.organization)
              .toLowerCase()
              .includes(q.toLowerCase())) &&
          (!category || e.category === category) &&
          (!organization ||
            e.organization
              .toLowerCase()
              .includes(organization.toLowerCase())) &&
          (!date ||
            dateLabel(e.start_time, {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }) ===
              dateLabel(date + "T12:00:00+08:00", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })) &&
          (!availability ||
            (availability === "open" &&
              !isClosed(e) &&
              (e.filled || 0) < e.capacity) ||
            (availability === "full" && (e.filled || 0) >= e.capacity) ||
            (availability === "waitlist" &&
              !isClosed(e) &&
              (e.filled || 0) >= e.capacity)),
      ),
    [upcoming, q, category, organization, date, availability],
  );
  const hasFilters = Boolean(
    q || category || organization || date || availability,
  );
  const discoveryState = { eventListSearch: params.toString() };
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  return (
    <>
      <div className="welcome-row">
        <div>
          <h1>
            {profile
              ? "Hey, " +
                profile.full_name.split(" ")[0] +
                ". Find your next thing."
              : "Find your people. Find your next thing."}
            <span className="greeting-star">✦</span>
          </h1>
          {demo && (
            <p className="demo-discovery-note">
              Demo mode · Sample events and registrations
            </p>
          )}
        </div>
        <div className="today-label">
          <CalendarDays size={16} />
          {dateLabel(new Date().toISOString(), {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="discover-layout">
        <div className="discover-main">
          <section className="campus-hero">
            <div className="hero-image" />
            <div className="hero-text">
              <h2>
                Your campus.
                <br />
                Your community.
              </h2>
              <a href="#upcoming-events" className="hero-button">
                Discover what’s on <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </section>
          <div className="discovery-stats">
            <div>
              <span className="stat-icon pale-green">
                <CalendarDays size={19} />
              </span>
              <strong>
                {upcoming.length}
                <small>Upcoming events</small>
              </strong>
            </div>
            <div>
              <span className="stat-icon pale-gold">
                <Users size={19} />
              </span>
              <strong>
                {new Set(events.map((e) => e.organization)).size}
                <small>Active organizations</small>
              </strong>
            </div>
            <div>
              <span className="stat-icon pale-lilac">
                <TicketSmall />
              </span>
              <strong>
                {events
                  .reduce((n, e) => n + (e.filled || 0), 0)
                  .toLocaleString()}
                <small>Campus registrations</small>
              </strong>
            </div>
          </div>
          <section id="upcoming-events" className="events-section">
            <div className="section-heading">
              <div>
                <h2>Find your next experience</h2>
                <p>There’s something for every kind of Carolinian.</p>
              </div>
              <Link to="/calendar" className="text-link">
                View calendar <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="event-search-row">
              <div className="search-box">
                <Search size={18} />
                <input
                  ref={searchInput}
                  aria-label="Search events"
                  placeholder="Search events, interests, or organizations…"
                  value={q}
                  onChange={(e) => filter("q", e.target.value)}
                />
                {q && (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => {
                      filter("q", "");
                      searchInput.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className={
                  "button filter-button " + (filters ? "selected" : "")
                }
                onClick={() => setFilters(!filters)}
                aria-expanded={filters}
              >
                <SlidersHorizontal size={16} />
                Filters{(date || organization || availability) && <i />}
              </button>
              <div className="view-toggle">
                <button
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={view === "grid" ? "selected" : ""}
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid size={17} />
                </button>
                <button
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
            {filters && (
              <div className="filter-panel">
                <label>
                  Date
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => filter("date", e.target.value)}
                  />
                </label>
                <label>
                  Organization
                  <select
                    value={organization}
                    onChange={(e) => filter("organization", e.target.value)}
                  >
                    <option value="">All organizations</option>
                    {[...new Set(events.map((e) => e.organization))].map(
                      (o) => (
                        <option key={o}>{o}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Availability
                  <select
                    value={availability}
                    onChange={(e) => filter("availability", e.target.value)}
                  >
                    <option value="">Any availability</option>
                    <option value="open">Slots available</option>
                    <option value="full">Full events</option>
                    <option value="waitlist">Waitlist available</option>
                  </select>
                </label>
                <button className="text-link" onClick={() => setParams({})}>
                  Reset filters
                </button>
              </div>
            )}
            <div
              className="category-tabs"
              role="group"
              aria-label="Event category"
            >
              {["", ...categories].map((value) => {
                const selected = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    className={selected ? "selected" : ""}
                    onClick={() => filter("category", value)}
                  >
                    {!value && <span aria-hidden="true">✧</span>}
                    {value || "All events"}
                  </button>
                );
              })}
            </div>
            <div className="results-label">
              <span role="status" aria-live="polite" aria-atomic="true">
                {!loading &&
                  !error &&
                  `${filtered.length} matching event${filtered.length === 1 ? "" : "s"}`}
              </span>
              {hasFilters && (
                <button type="button" onClick={clearFilters}>
                  Clear all <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
            {loading ? (
              <Loading />
            ) : error ? (
              <div className="error-message">
                {error}
                <button onClick={() => void refresh()}>Try again</button>
              </div>
            ) : filtered.length ? (
              <>
                <div className={view === "grid" ? "event-grid" : "event-list"}>
                  {filtered.slice(0, limit).map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      list={view === "list"}
                      navigationState={discoveryState}
                    />
                  ))}
                </div>
                {filtered.length > limit ? (
                  <button
                    className="button load-more"
                    onClick={() => setLimit((n) => n + 6)}
                  >
                    Show more events <ArrowRight size={16} />
                  </button>
                ) : (
                  <div className="end-note">
                    <span />
                    You’re all caught up. Your next memory is waiting.
                    <span />
                  </div>
                )}
              </>
            ) : (
              <Empty
                title="No events found"
                body="Try another keyword or clear a filter to find your next campus experience."
                action={
                  <button className="button primary" onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              />
            )}
          </section>
        </div>
        <aside className="discovery-rail">
          <section className="mini-calendar panel">
            <div className="rail-heading">
              <h3>
                {month.toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div>
                <button
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="mini-calendar-grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span className="mini-day-name" key={"day" + i}>
                  {d}
                </span>
              ))}
              {Array.from({ length: firstDay }, (_, i) => (
                <span key={"blank" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const d = i + 1,
                  iso =
                    month.getFullYear() +
                    "-" +
                    String(month.getMonth() + 1).padStart(2, "0") +
                    "-" +
                    String(d).padStart(2, "0");
                const eventDay = upcoming.some(
                  (e) =>
                    dateLabel(e.start_time, {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    }) ===
                    dateLabel(iso + "T12:00:00+08:00", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    }),
                );
                return (
                  <button
                    key={d}
                    onClick={() => filter("date", date === iso ? "" : iso)}
                    aria-label={"Events on " + iso}
                    className={
                      (d === today.getDate() &&
                      month.getMonth() === today.getMonth() &&
                      month.getFullYear() === today.getFullYear()
                        ? "today "
                        : "") +
                      (date === iso ? "chosen " : "") +
                      (eventDay ? "has-event" : "")
                    }
                  >
                    {d}
                    {eventDay && <i />}
                  </button>
                );
              })}
            </div>
            <div className="calendar-key">
              <i /> Upcoming event{" "}
              <span>
                <i /> Today
              </span>
            </div>
            <Link to="/calendar" className="calendar-full-link">
              Open full calendar <ArrowRight size={14} />
            </Link>
          </section>
          <section className="coming-up">
            <div className="rail-heading">
              <h3>Coming up next</h3>
              <span className="live-dot" />
            </div>
            {upcoming.slice(0, 3).map((e) => (
              <Link
                to={"/events/" + e.id}
                state={discoveryState}
                className="up-next-event"
                key={e.id}
              >
                <DateTile value={e.start_time} />
                <div>
                  <h4>{e.title.split(":")[0]}</h4>
                  <p>
                    <Clock3 size={11} />
                    {timeLabel(e.start_time)}
                  </p>
                  <span>{e.venue.split(",")[0]}</span>
                </div>
              </Link>
            ))}
            <Link to="/registrations" className="text-link">
              See my registrations <ArrowRight size={14} />
            </Link>
          </section>
          <section className="campus-note">
            <div className="campus-note-icon">
              <Sparkles size={20} />
            </div>
            <span className="eyebrow">CAMPUS BULLETIN</span>
            <h3>Stay in the loop.</h3>
            <p>
              {announcements[0]?.body ||
                "Important updates, new opportunities, and all things Carolinian. Keep up with your campus community."}
            </p>
            <Link to="/notifications">
              Read announcements <ArrowUpRight size={15} />
            </Link>
          </section>
          <div className="community-note">
            <GraduationCap size={22} />
            <p>
              A community of learners.
              <br />
              <strong>A lifetime of connections.</strong>
            </p>
            <span>EST. 1595</span>
          </div>
        </aside>
      </div>
    </>
  );
}
function TicketSmall() {
  return <span className="ticket-stat">✧</span>;
}
