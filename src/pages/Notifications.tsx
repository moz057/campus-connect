import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Megaphone,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useOrganizations } from "../contexts/OrganizationContext";
import { useToast } from "../contexts/ToastContext";
import { dateLabel } from "../lib/utils";
import {
  PageTitle,
  Field,
  Empty,
  ErrorMessage,
  Loading,
} from "../components/Common";

export default function Notifications() {
  const { profile } = useAuth();
  const {
    announcements,
    events,
    postAnnouncement,
    refresh: refreshCampus,
    loading: campusLoading,
    error: campusError,
  } = useData();
  const {
    organizer,
    manageable,
    canManage,
    notifications,
    announcementReads,
    scope,
    markRead,
    refresh,
    loading,
    error,
  } = useOrganizations();
  const notify = useToast();
  const admin = profile?.role === "admin";
  const [tab, setTab] = useState("all");
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const readIds = new Set(
    announcementReads.map((receipt) => receipt.announcement_id),
  );
  const updates = [
    ...notifications.map((n) => ({
      ...n,
      unread: !n.read_at,
      announcement: false,
    })),
    ...announcements.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      title: a.title,
      message: a.body,
      unread: !readIds.has(a.id),
      announcement: true,
      destination: a.event_id
        ? "/events/" + a.event_id
        : a.organization_id
          ? "/organizations/" + a.organization_id
          : "",
      type: a.event_id
        ? "Event announcement"
        : a.organization_id
          ? "Organization announcement"
          : "Campus announcement",
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unread = updates.filter((item) => item.unread);

  async function mark(id?: string, announcement = false) {
    try {
      await markRead(announcements, id, announcement);
      if (!id) notify("All updates marked as read.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setProblem("");
    setBusy(true);
    try {
      await postAnnouncement(
        title.trim(),
        body.trim(),
        audience.startsWith("event:") ? audience.slice(6) : null,
        audience.startsWith("org:") ? audience.slice(4) : null,
      );
      setTitle("");
      setBody("");
      setCompose(false);
      notify("Announcement posted.");
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = tab === "unread" ? unread : updates;
  return (
    <>
      <PageTitle
        title="Notifications"
        description="Personal notifications and announcements from CampusConnect."
        action={
          <div className="button-row">
            <button
              className="button"
              onClick={() => void Promise.all([refresh(), refreshCampus()])}
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              className="button"
              disabled={!unread.length}
              onClick={() => void mark()}
            >
              <CheckCheck size={16} /> Mark all as read
            </button>
            {organizer && (
              <button
                className="button primary"
                onClick={() => {
                  if (!compose)
                    setAudience(
                      scope && manageable.some((org) => org.id === scope)
                        ? "org:" + scope
                        : "",
                    );
                  setCompose(!compose);
                }}
              >
                <Megaphone size={16} /> Post announcement
              </button>
            )}
          </div>
        }
      />
      <ErrorMessage message={error || campusError} />
      {compose && organizer && (
        <form className="panel compose-panel" onSubmit={publish}>
          <h2>Post an announcement</h2>
          <ErrorMessage message={problem} />
          <div className="form-grid">
            <Field label="Title">
              <input
                required
                minLength={3}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Audience">
              <select
                required={!admin}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="">
                  {admin ? "Everyone on campus" : "Choose an audience"}
                </option>
                {manageable.map((org) => (
                  <option key={org.id} value={"org:" + org.id}>
                    {org.name} members
                  </option>
                ))}
                {events
                  .filter(
                    (event) =>
                      !event.cancelled_at && canManage(event.organization_id),
                  )
                  .map((event) => (
                    <option key={event.id} value={"event:" + event.id}>
                      {event.title} registrants
                    </option>
                  ))}
              </select>
            </Field>
            <div className="span-two">
              <Field label="Message">
                <textarea
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="form-footer">
            <button className="button primary" disabled={busy}>
              {busy ? "Posting…" : "Publish announcement"}
            </button>
          </div>
        </form>
      )}
      <div className="page-tabs">
        {["all", "unread"].map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name === "all" ? "All" : "Unread"}{" "}
            <span>{name === "all" ? updates.length : unread.length}</span>
          </button>
        ))}
      </div>
      {loading || campusLoading ? (
        <Loading />
      ) : visible.length ? (
        <div className="announcements-list">
          {visible.map((item) => (
            <article
              className={
                "announcement-card panel " + (item.unread ? "unread" : "")
              }
              key={item.id}
            >
              <div className="announcement-icon pale-green">
                {item.announcement ? (
                  <Megaphone size={22} />
                ) : (
                  <Bell size={22} />
                )}
              </div>
              <div>
                <div className="announcement-topline">
                  <span className="eyebrow">
                    {item.announcement ? item.type : "Personal notification"}
                  </span>
                  <time dateTime={item.created_at}>
                    {dateLabel(item.created_at, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <h2>
                  {item.destination ? (
                    <Link
                      to={item.destination}
                      onClick={() =>
                        item.unread && void mark(item.id, item.announcement)
                      }
                    >
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </h2>
                <p className="preserve-lines">{item.message}</p>
                <div className="announcement-actions">
                  {item.destination && (
                    <Link
                      className="text-link"
                      to={item.destination}
                      onClick={() =>
                        item.unread && void mark(item.id, item.announcement)
                      }
                    >
                      Open <ArrowUpRight size={14} />
                    </Link>
                  )}
                  {item.unread && (
                    <button
                      className="text-link"
                      onClick={() => void mark(item.id, item.announcement)}
                    >
                      Mark as read <CheckCheck size={14} />
                    </button>
                  )}
                </div>
              </div>
              {item.unread && <span className="unread-dot" />}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            tab === "unread" ? "You're all caught up" : "No notifications yet"
          }
        />
      )}
    </>
  );
}
