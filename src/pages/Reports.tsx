import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Download,
  Users,
  ClipboardCheck,
  TrendingUp,
  Ticket,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { dateLabel, downloadCSV } from "../lib/utils";
import { PageTitle, Empty } from "../components/Common";
export default function Reports() {
  const { events, registrations, attendance, people } = useData();
  const [selected, setSelected] = useState("");
  const scoped = events.filter((e) => !selected || e.id === selected);
  const regs = registrations.filter(
    (r) => !selected || r.event_id === selected,
  );
  const confirmed = regs.filter((r) => r.status === "registered"),
    attendees = attendance.filter((a) =>
      confirmed.some((r) => r.id === a.registration_id),
    );
  const rate = confirmed.length
    ? Math.round((attendees.length / confirmed.length) * 100)
    : 0;
  const trend = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const day = new Date();
        day.setDate(day.getDate() - 13 + i);
        const key = dateLabel(day.toISOString(), {
          month: "short",
          day: "numeric",
        });
        return {
          date: key,
          Registrations: regs.filter(
            (r) =>
              r.status !== "cancelled" &&
              dateLabel(r.created_at, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }) ===
                dateLabel(day.toISOString(), {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }),
          ).length,
        };
      }),
    [regs],
  );
  const comparison = scoped.map((e) => ({
    name: e.title.split(":")[0].slice(0, 20),
    fullName: e.title,
    Registered: registrations.filter(
      (r) => r.event_id === e.id && r.status === "registered",
    ).length,
    Attended: attendance.filter((a) =>
      registrations.some(
        (r) => r.id === a.registration_id && r.event_id === e.id,
      ),
    ).length,
  }));
  function exportData() {
    downloadCSV(
      "campusconnect-report-" + new Date().toISOString().slice(0, 10) + ".csv",
      [
        [
          "Event",
          "Student",
          "Student ID",
          "Course",
          "Year level",
          "Registration status",
          "Registered at",
          "Attended",
          "Checked in at",
        ],
        ...regs.map((r) => {
          const e = events.find((e) => e.id === r.event_id),
            p = people.find((p) => p.id === r.user_id),
            a = attendance.find((a) => a.registration_id === r.id);
          return [
            e?.title,
            p?.full_name,
            p?.student_id,
            p?.course,
            p?.year_level,
            r.status,
            r.created_at,
            a ? "Yes" : "No",
            a?.checked_in_at || "",
          ];
        }),
      ],
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="FROM MOMENTS TO MEANING"
        title="See the difference you make."
        description="Understand your events, celebrate participation, and plan what comes next."
        action={
          <button
            className="button primary"
            disabled={!regs.length}
            onClick={exportData}
          >
            <Download size={16} />
            Export CSV
          </button>
        }
      />
      <div className="report-filter panel">
        <label htmlFor="report-event">Reporting on</label>
        <select
          id="report-event"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">All campus events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <span>Registration trend: last 14 days · Attendance: all time</span>
      </div>
      <div className="dashboard-stats">
        {[
          {
            label: "Confirmed registrations",
            value: confirmed.length,
            icon: Users,
            color: "pale-green",
          },
          {
            label: "Students attended",
            value: attendees.length,
            icon: ClipboardCheck,
            color: "pale-gold",
          },
          {
            label: "Attendance rate",
            value: rate + "%",
            icon: TrendingUp,
            color: "pale-lilac",
          },
          {
            label: "On the waitlist",
            value: regs.filter((r) => r.status === "waitlisted").length,
            icon: Ticket,
            color: "pale-peach",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div className="panel metric-card" key={label}>
            <span className={"stat-icon " + color}>
              <Icon size={21} />
            </span>
            <span className="metric-label">{label}</span>
            <strong>{value}</strong>
            <small>
              {label === "Attendance rate"
                ? "Attendees ÷ confirmed registrations"
                : "Across selected events"}
            </small>
          </div>
        ))}
      </div>
      <div className="report-charts">
        <section className="panel chart-panel">
          <h2>Registrations over time</h2>
          <p>Daily active registrations · Last 14 days</p>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={trend}
                margin={{ top: 15, right: 15, bottom: 5, left: -20 }}
              >
                <defs>
                  <linearGradient
                    id="greenGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#1B5E20" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1B5E20" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e8ece5"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={25}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8dd",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Registrations"
                  stroke="#1B5E20"
                  strokeWidth={2.5}
                  fill="url(#greenGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel chart-panel">
          <h2>Showing up, by event</h2>
          <p>Confirmed registrations compared with check-ins</p>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={comparison}
                margin={{ top: 15, right: 15, bottom: 5, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e8ece5"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={(name) => name.slice(0, 12) + "…"}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fullName || ""
                  }
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8dd",
                    fontSize: 12,
                    maxWidth: 250,
                    whiteSpace: "normal",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="Registered"
                  fill="#1B5E20"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="Attended"
                  fill="#FFC20E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Event performance</h2>
          <span className="small-copy muted">{scoped.length} events</span>
        </div>
        {scoped.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Registrants</th>
                  <th>Attendees</th>
                  <th>Attendance rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scoped.map((e) => {
                  const registered = registrations.filter(
                      (r) => r.event_id === e.id && r.status === "registered",
                    ),
                    count = attendance.filter((a) =>
                      registered.some((r) => r.id === a.registration_id),
                    ).length;
                  return (
                    <tr key={e.id}>
                      <td>
                        <button
                          className="table-title-button"
                          onClick={() => setSelected(e.id)}
                        >
                          {e.title}
                        </button>
                        <small className="table-subtitle">
                          {dateLabel(e.start_time)} · {e.organization}
                        </small>
                      </td>
                      <td>
                        {registered.length}{" "}
                        <span className="muted">/ {e.capacity}</span>
                      </td>
                      <td>{count}</td>
                      <td>
                        <div className="table-rate">
                          <div className="card-progress">
                            <div
                              style={{
                                width:
                                  (registered.length
                                    ? (count / registered.length) * 100
                                    : 0) + "%",
                              }}
                            />
                          </div>
                          <strong>
                            {registered.length
                              ? Math.round((count / registered.length) * 100)
                              : 0}
                            %
                          </strong>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            new Date(e.end_time).getTime() < Date.now()
                              ? "neutral-badge"
                              : "success-badge"
                          }
                        >
                          {new Date(e.end_time).getTime() < Date.now()
                            ? "Completed"
                            : "Upcoming"}
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
            title="Your impact starts here"
            body="Reports will appear when your first event is published."
          />
        )}
      </section>
      {selected && (
        <section className="panel report-registrants">
          <div className="panel-header">
            <h2>Event registrants</h2>
            <span className="muted small-copy">
              Included in your CSV export
            </span>
          </div>
          {regs.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map((r) => {
                    const p = people.find((p) => p.id === r.user_id),
                      a = attendance.find((a) => a.registration_id === r.id);
                    return (
                      <tr key={r.id}>
                        <td>{p?.full_name || "Student"}</td>
                        <td>{p?.student_id || "—"}</td>
                        <td>{dateLabel(r.created_at)}</td>
                        <td>
                          <span
                            className={
                              r.status === "registered"
                                ? "success-badge"
                                : "neutral-badge"
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {a
                            ? dateLabel(a.checked_in_at, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Not checked in"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No registrations yet"
              body="Share the event and invite your community."
            />
          )}
        </section>
      )}
    </>
  );
}
