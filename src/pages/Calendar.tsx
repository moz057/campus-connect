import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData } from "../contexts/DataContext";
import { categories } from "../lib/types";
import { PageTitle, Loading, Empty } from "../components/Common";
export default function Calendar() {
  const { events, loading } = useData();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
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
      {loading ? (
        <Loading />
      ) : (
        <div className="panel full-calendar">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek",
            }}
            buttonText={{ today: "Today", month: "Month", week: "Week" }}
            height="auto"
            eventColor="#1B5E20"
            dayMaxEvents={3}
            events={events
              .filter((e) => !category || e.category === category)
              .map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start_time,
                end: e.end_time,
                backgroundColor:
                  e.category === "Arts & Culture"
                    ? "#7b5b9a"
                    : e.category === "Sports"
                      ? "#bb7525"
                      : "#1B5E20",
                borderColor: "transparent",
              }))}
            eventClick={(info) => navigate("/events/" + info.event.id)}
            eventTimeFormat={{
              hour: "numeric",
              minute: "2-digit",
              meridiem: "short",
            }}
          />
          {events.length === 0 && (
            <Empty
              title="A fresh calendar"
              body="New campus events will appear here once an organizer publishes them."
            />
          )}
        </div>
      )}
    </>
  );
}
