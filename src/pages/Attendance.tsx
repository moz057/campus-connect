import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ScanLine,
  Search,
  CheckCircle2,
  Camera,
  X,
  Users,
  ClipboardCheck,
  Download,
} from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { useWorkspaceData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { dateLabel, timeLabel, downloadCSV } from "../lib/utils";
import { PageTitle, Empty, ErrorMessage } from "../components/Common";
export default function Attendance() {
  const {
    events,
    registrations,
    people,
    attendance,
    checkIn,
    cancelManagedRegistration,
  } = useWorkspaceData();
  const { demo } = useAuth();
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const requestedEvent = params.get("event");
  const eventId =
    events.find((event) => event.id === requestedEvent)?.id ||
    events[0]?.id ||
    "";
  const [search, setSearch] = useState(""),
    [token, setToken] = useState(""),
    [scanning, setScanning] = useState(false),
    [cameraStarting, setCameraStarting] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const scanner = useRef<Html5Qrcode | null>(null);
  const mounted = useRef(true);
  const scanLock = useRef(false);
  const selectedRef = useRef(eventId);
  selectedRef.current = eventId;
  const checkInRef = useRef(checkIn);
  checkInRef.current = checkIn;
  const event = events.find((e) => e.id === eventId),
    regs = registrations.filter(
      (r) => r.event_id === eventId && r.status !== "cancelled",
    );
  const checked = regs.filter((r) =>
    attendance.some((a) => a.registration_id === r.id),
  );
  async function stop() {
    const instance = scanner.current;
    scanner.current = null;
    if (instance) {
      try {
        if (instance.isScanning) await instance.stop();
        instance.clear();
      } catch {
        /* Camera might already be closed. */
      }
    }
    if (mounted.current) setScanning(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const s = scanner.current;
      if (s?.isScanning)
        void s
          .stop()
          .then(() => s.clear())
          .catch(() => {});
      scanner.current = null;
    };
  }, []);
  async function process(raw: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    setError("");
    try {
      let value = raw.trim();
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        if (parsed.event_id !== selectedRef.current)
          throw Error("This ticket belongs to a different event.");
        value = parsed.token;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))
        throw Error("Enter a valid QR token or scan a CampusConnect ticket.");
      await checkInRef.current(selectedRef.current, value);
      notify("Student checked in. Welcome to the event!");
      setToken("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTimeout(() => {
        scanLock.current = false;
      }, 1500);
    }
  }
  async function start() {
    setError("");
    setScanning(true);
    setCameraStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!mounted.current) return;
      const s = new Html5Qrcode("qr-reader");
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 230, height: 230 } },
        (raw) => {
          void process(raw);
        },
        () => {},
      );
      if (!mounted.current) {
        await s.stop();
        s.clear();
      }
    } catch (e) {
      if (!mounted.current) return;
      await stop();
      setError(
        "Could not open the camera. Allow camera access in your browser or use manual check-in. " +
          (e instanceof Error ? e.message : ""),
      );
    } finally {
      if (mounted.current) setCameraStarting(false);
    }
  }
  const filtered = regs.filter((r) => {
    const p = people.find((p) => p.id === r.user_id);
    return (
      !search ||
      ((p?.full_name || "") + " " + (p?.student_id || ""))
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  function exportAttendance() {
    downloadCSV("campusconnect-attendance.csv", [
      [
        "Event",
        "Student",
        "Student ID",
        "Registration status",
        "Checked in",
        "Check-in time",
      ],
      ...regs.map((r) => {
        const p = people.find((p) => p.id === r.user_id),
          a = attendance.find((a) => a.registration_id === r.id);
        return [
          event?.title,
          p?.full_name,
          p?.student_id,
          r.status,
          a ? "Yes" : "No",
          a?.checked_in_at || "",
        ];
      }),
    ]);
  }
  return (
    <>
      <PageTitle
        eyebrow="WELCOME THEM IN"
        title="Every arrival, accounted for."
        description="Scan a campus pass or check in a student by hand."
        action={
          <button
            className="button"
            disabled={!event}
            onClick={exportAttendance}
          >
            <Download size={16} />
            Export attendance
          </button>
        }
      />
      <div className="panel event-selector">
        <label htmlFor="attendance-event">Select an event</label>
        <select
          id="attendance-event"
          disabled={scanning || cameraStarting}
          value={eventId}
          onChange={(e) => {
            void stop();
            setParams({ event: e.target.value });
            setError("");
            setSearch("");
          }}
        >
          {events.map((e) => (
            <option value={e.id} key={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {event && (
          <span>
            {dateLabel(event.start_time)} · {timeLabel(event.start_time)}
          </span>
        )}
      </div>
      {!event ? (
        <Empty
          title="Create an event to get started"
          body="Once students register, you can manage their attendance here."
        />
      ) : (
        <>
          <div className="attendance-layout">
            <section className="panel scanner-panel">
              <span className="stat-icon pale-green">
                <ScanLine size={25} />
              </span>
              <h2>A quick scan. A warm welcome.</h2>
              <p>
                Choose the right event above, then scan the student’s QR ticket.
              </p>
              <ErrorMessage message={error} />
              <div
                id="qr-reader"
                className={scanning ? "scanner-active" : "scanner-idle"}
              >
                {!scanning && (
                  <div className="scan-placeholder">
                    <span />
                    <ScanLine size={70} strokeWidth={1} />
                    <p>Their next campus moment starts here.</p>
                  </div>
                )}
              </div>
              <button
                className="button primary full-width"
                disabled={cameraStarting}
                onClick={() => {
                  if (scanning) void stop();
                  else void start();
                }}
              >
                {cameraStarting ? (
                  "Opening camera…"
                ) : scanning ? (
                  <>
                    <X size={16} />
                    Stop camera
                  </>
                ) : (
                  <>
                    <Camera size={17} />
                    Open QR scanner
                  </>
                )}
              </button>
              <form
                className="manual-token-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void process(token);
                }}
              >
                <label htmlFor="qr-token">Or enter a QR token</label>
                <div>
                  <input
                    id="qr-token"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste ticket token or QR contents"
                  />
                  <button className="button" disabled={!token}>
                    Check in
                  </button>
                </div>
              </form>
              {demo && (
                <div className="info-note">
                  Demo check-in is available at any time. With Supabase
                  connected, check-in opens two hours before the event.
                </div>
              )}
            </section>
            <section>
              <div className="attendance-mini-stats">
                <div className="panel">
                  <Users size={20} />
                  <strong>
                    {regs.filter((r) => r.status === "registered").length}
                  </strong>
                  <span>Registered</span>
                </div>
                <div className="panel">
                  <ClipboardCheck size={20} />
                  <strong>{checked.length}</strong>
                  <span>Checked in</span>
                </div>
                <div className="panel">
                  <CheckCircle2 size={20} />
                  <strong>
                    {regs.filter((r) => r.status === "registered").length
                      ? Math.round(
                          (checked.length /
                            regs.filter((r) => r.status === "registered")
                              .length) *
                            100,
                        )
                      : 0}
                    %
                  </strong>
                  <span>Attendance</span>
                </div>
              </div>
              <div className="panel registrant-panel">
                <div className="panel-header">
                  <h2>
                    On the guest list{" "}
                    <span className="count-tag">{regs.length}</span>
                  </h2>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search registrants"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or student ID…"
                  />
                </div>
                <div className="registrant-list">
                  {filtered.length ? (
                    filtered.map((r) => {
                      const p = people.find((p) => p.id === r.user_id),
                        a = attendance.find((a) => a.registration_id === r.id);
                      return (
                        <div className="registrant-row" key={r.id}>
                          <div>
                            <h3>{p?.full_name || "Student"}</h3>
                            <p>
                              {p?.student_id} · {p?.course || "USC student"}
                            </p>
                          </div>
                          {a ? (
                            <span className="checked-in-label">
                              <CheckCircle2 size={15} />
                              {timeLabel(a.checked_in_at)}
                            </span>
                          ) : r.status === "waitlisted" ? (
                            <span className="waitlist-badge">Waitlisted</span>
                          ) : (
                            <button
                              className="button small-button"
                              disabled={
                                busy === r.id || Boolean(event.cancelled_at)
                              }
                              onClick={async () => {
                                setBusy(r.id);
                                try {
                                  await checkIn(eventId, r.id, true);
                                  notify(
                                    (p?.full_name || "Student") +
                                      " checked in.",
                                  );
                                } catch (e) {
                                  notify((e as Error).message, true);
                                } finally {
                                  setBusy("");
                                }
                              }}
                            >
                              {busy === r.id ? "Saving…" : "Check in"}
                            </button>
                          )}
                          {!a &&
                            !event.cancelled_at &&
                            Date.parse(event.start_time) > Date.now() && (
                              <button
                                type="button"
                                className="danger-link"
                                disabled={busy === r.id}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      "Cancel this student's registration?",
                                    )
                                  )
                                    return;
                                  setBusy(r.id);
                                  try {
                                    await cancelManagedRegistration(
                                      eventId,
                                      r.user_id,
                                    );
                                    notify("Registration cancelled.");
                                  } catch (e) {
                                    notify((e as Error).message, true);
                                  } finally {
                                    setBusy("");
                                  }
                                }}
                              >
                                Cancel registration
                              </button>
                            )}
                        </div>
                      );
                    })
                  ) : (
                    <Empty
                      title="No registrants found"
                      body="Try another name, or wait for students to register."
                    />
                  )}
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
