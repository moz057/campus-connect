import { Link } from "react-router-dom";
import {
  CalendarDays,
  Users,
  Ticket,
  ClipboardCheck,
  Plus,
  ArrowUpRight,
  Megaphone,
  ScanLine,
  TrendingUp,
} from "lucide-react";
import { useWorkspaceData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { PageTitle, Empty, Loading, DateTile } from "../components/Common";
import { dateLabel, timeLabel, initials } from "../lib/utils";
export default function Dashboard() {
  const { profile, demo } = useAuth();
  const { events, people, registrations, attendance, loading } =
    useWorkspaceData();
  if (loading) return <Loading />;
  const active = registrations.filter((r) => r.status === "registered"),
    rate = active.length
      ? Math.round((attendance.length / active.length) * 100)
      : 0;
  const upcoming = events
    .filter(
      (e) => !e.cancelled_at && new Date(e.end_time).getTime() >= Date.now(),
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return (
    <>
      <PageTitle
        eyebrow="ORGANIZER WORKSPACE"
        title={
          "Let’s make things happen, " + profile?.full_name.split(" ")[0] + "."
        }
        description="A little perspective on your campus. A clear view of what’s next."
        action={
          <Link to="/admin/events/new" className="button primary">
            <Plus size={17} />
            Create an event
          </Link>
        }
      />
      {demo && (
        <div className="demo-inline">
          <span className="live-dot" />
          Organizer demo · Sample campus data. Changes stay in this browser.
        </div>
      )}
      <div className="dashboard-stats">
        {[
          {
            label: "Total events",
            value: events.length,
            icon: CalendarDays,
            color: "pale-green",
            detail: upcoming.length + " coming up",
          },
          {
            label: "Participants",
            value: people.filter((p) => p.role === "student").length,
            icon: Users,
            color: "pale-lilac",
            detail: "Students on event rosters",
          },
          {
            label: "Registrations",
            value: active.length,
            icon: Ticket,
            color: "pale-gold",
            detail:
              registrations.filter((r) => r.status === "waitlisted").length +
              " on waitlists",
          },
          {
            label: "Attendance rate",
            value: rate + "%",
            icon: ClipboardCheck,
            color: "pale-peach",
            detail: attendance.length + " checked in",
          },
        ].map(({ label, value, icon: Icon, color, detail }) => (
          <div className="panel metric-card" key={label}>
            <span className={"stat-icon " + color}>
              <Icon size={21} />
            </span>
            <span className="metric-label">{label}</span>
            <strong>
              {typeof value === "number" ? value.toLocaleString() : value}
            </strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel dashboard-events">
          <div className="panel-header">
            <h2>What’s coming up</h2>
            <Link className="text-link" to="/events">
              All events <ArrowUpRight size={14} />
            </Link>
          </div>
          {upcoming.length ? (
            upcoming.slice(0, 5).map((e) => (
              <div className="dashboard-event-row" key={e.id}>
                <DateTile value={e.start_time} />
                <div>
                  <Link to={"/events/" + e.id}>
                    <h3>{e.title}</h3>
                  </Link>
                  <p>
                    {timeLabel(e.start_time)} · {e.venue}
                  </p>
                </div>
                <div className="dashboard-event-capacity">
                  <strong>
                    {e.filled || 0}
                    <span> / {e.capacity}</span>
                  </strong>
                  <div className="card-progress">
                    <div
                      style={{
                        width:
                          Math.min(100, ((e.filled || 0) / e.capacity) * 100) +
                          "%",
                      }}
                    />
                  </div>
                </div>
                <Link
                  className="icon-button"
                  aria-label={"Edit " + e.title}
                  to={"/admin/events/" + e.id + "/edit"}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            ))
          ) : (
            <Empty
              title="Your calendar has room"
              body="Create your first event and bring the campus together."
            />
          )}
        </section>
        <aside className="panel quick-actions">
          <h2>Make your next move</h2>
          <p>Good campus experiences start here.</p>
          {[
            {
              to: "/admin/events/new",
              icon: Plus,
              title: "Create an event",
              body: "Give your idea a place on campus",
            },
            {
              to: "/admin/attendance",
              icon: ScanLine,
              title: "Check in students",
              body: "Scan a ticket or mark attendance",
            },
            {
              to: "/notifications",
              icon: Megaphone,
              title: "Share an update",
              body: "Keep your community informed",
            },
            {
              to: "/admin/reports",
              icon: TrendingUp,
              title: "Explore reports",
              body: "See the impact of your events",
            },
          ].map(({ to, icon: Icon, title, body }) => (
            <Link to={to} key={to}>
              <span className="stat-icon pale-green">
                <Icon size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{body}</small>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </aside>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Recent registrations</h2>
          <span className="muted small-copy">The community is showing up.</span>
        </div>
        {registrations.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Event</th>
                  <th>Registered</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...registrations]
                  .filter((r) => r.status !== "cancelled")
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, 7)
                  .map((r) => {
                    const p = people.find((p) => p.id === r.user_id),
                      e = events.find((e) => e.id === r.event_id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="table-person">
                            <span className="avatar small">
                              {initials(p?.full_name || "Student")}
                            </span>
                            <span>
                              <strong>{p?.full_name || "Student"}</strong>
                              <small>{p?.student_id}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <Link
                            className="table-event-link"
                            to={"/events/" + e?.id}
                          >
                            {e?.title}
                          </Link>
                        </td>
                        <td>{dateLabel(r.created_at)}</td>
                        <td>
                          <span
                            className={
                              r.status === "registered"
                                ? "success-badge"
                                : "waitlist-badge"
                            }
                          >
                            {r.status === "registered"
                              ? "Registered"
                              : "Waitlisted"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Ready for your first registration"
            body="Students will appear here after registering for an event."
          />
        )}
      </section>
    </>
  );
}
