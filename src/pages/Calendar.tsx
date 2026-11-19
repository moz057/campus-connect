import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Link, useNavigate } from "react-router-dom";
import { useState, useSyncExternalStore } from "react";
import { useData } from "../contexts/DataContext";
import { categories, type CampusEvent } from "../lib/types";
import { PageTitle, Loading, Empty } from "../components/Common";

const agendaBreakpoint = "(max-width: 900px)";
const dayLabel = new Intl.DateTimeFormat("en", { dateStyle: "full" });
const timeLabel = new Intl.DateTimeFormat("en", { timeStyle: "short" });

function subscribeToAgendaBreakpoint(onChange: () => void) {
  const media = window.matchMedia?.(agendaBreakpoint);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function preferAgenda() {
  return window.matchMedia?.(agendaBreakpoint).matches ?? false;
}

const views = [
  { id: "dayGridMonth", label: "Month" },
  { id: "timeGridWeek", label: "Week" },
  { id: "agenda", label: "Agenda" },
] as const;
type CalendarView = (typeof views)[number]["id"];

function Agenda({ events }: { events: CampusEvent[] }) {
  const now = Date.now();
  const days = new Map<string, CampusEvent[]>();
  for (const event of events
    .filter((event) => Date.parse(event.end_time) >= now)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))) {
    const day = dayLabel.format(new Date(event.start_time));
    const rows = days.get(day) ?? [];
    rows.push(event);
    days.set(day, rows);
  }

  if (!days.size)
    return (
      <Empty
        title="No upcoming events"
        body="Try choosing another category or switch to Month to see past events."
      />
    );

  return (
    <div className="calendar-agenda" aria-label="Upcoming events agenda">
      {[...days].map(([day, rows]) => (
        <section className="agenda-day" key={day}>
          <h2>{day}</h2>
          <ul>
            {rows.map((event) => {
              const start = new Date(event.start_time);
              const end = new Date(event.end_time);
              const endDay = dayLabel.format(end);
              return (
                <li className="agenda-event" key={event.id}>
                  <Link
                    className="agenda-event-title"
                    to={"/events/" + event.id}
                  >
                    {event.title}
                  </Link>
                  <div className="agenda-event-facts">
                    <span>
                      <time dateTime={event.start_time}>
                        {timeLabel.format(start)}
                      </time>
                      {" – "}
                      <time dateTime={event.end_time}>
                        {endDay !== day ? endDay + " at " : ""}
                        {timeLabel.format(end)}
                      </time>
                    </span>
                    <span>{event.venue}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Calendar() {
  const { events, loading } = useData();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [chosenView, setChosenView] = useState<CalendarView>();
  const narrow = useSyncExternalStore(
    subscribeToAgendaBreakpoint,
    preferAgenda,
    () => false,
  );
  const view = chosenView ?? (narrow ? "agenda" : "dayGridMonth");
  const visibleEvents = events.filter(
    (event) =>
      !event.cancelled_at && (!category || event.category === category),
  );

  return (
    <>
      <PageTitle
        eyebrow="MAKE ROOM FOR WHAT MATTERS"
        title="Your campus, on the calendar"
        description="Plan ahead for the talks, games, and moments you don’t want to miss."
        action={
          <select
            aria-label="Filter calendar by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        }
      />
      <div className="calendar-timezone">
        Times follow your device’s local timezone. Event details and QR tickets
        display Philippine Time (PHT).
      </div>
      <div
        className="calendar-view-controls"
        role="group"
        aria-label="Calendar view"
      >
        {views.map(({ id, label }) => (
          <button
            type="button"
            className={"button " + (view === id ? "primary" : "")}
            key={id}
            aria-pressed={view === id}
            onClick={() => setChosenView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="panel full-calendar">
          {view === "agenda" ? (
            <Agenda events={visibleEvents} />
          ) : (
            <FullCalendar
              key={view}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              buttonText={{ today: "Today" }}
              height="auto"
              eventColor="#1B5E20"
              dayMaxEvents={3}
              events={visibleEvents.map((event) => ({
                id: event.id,
                url: "/events/" + event.id,
                title: event.title,
                start: event.start_time,
                end: event.end_time,
                backgroundColor:
                  event.category === "Arts & Culture"
                    ? "#7b5b9a"
                    : event.category === "Sports"
                      ? "#bb7525"
                      : "#1B5E20",
                borderColor: "transparent",
              }))}
              eventClick={({ jsEvent, event }) => {
                if (
                  !jsEvent.ctrlKey &&
                  !jsEvent.metaKey &&
                  !jsEvent.shiftKey &&
                  !jsEvent.altKey
                ) {
                  jsEvent.preventDefault();
                  navigate(event.url);
                }
              }}
              eventTimeFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
