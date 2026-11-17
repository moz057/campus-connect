import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Megaphone, ArrowUpRight, Send } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { dateLabel } from "../lib/utils";
import { PageTitle, Field, Empty, ErrorMessage } from "../components/Common";
export default function Notifications() {
  const { profile } = useAuth();
  const { announcements, events, postAnnouncement } = useData();
  const notify = useToast();
  const key = "cc-read-" + profile?.id;
  const [read, setRead] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem(key) || "[]"),
  );
  const [tab, setTab] = useState("all"),
    [compose, setCompose] = useState(false),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [event, setEvent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const unread = announcements.filter((a) => !read.includes(a.id));
  function mark(ids: string[]) {
    const next = [...new Set([...read, ...ids])];
    setRead(next);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("cc-read"));
  }
  return (
    <>
      <PageTitle
        eyebrow="THE CAMPUS CONVERSATION"
        title="Stay in the loop"
        description="The latest updates from your university and the events you’re part of."
        action={
          <div className="button-row">
            <button
              className="button"
              onClick={() => mark(announcements.map((a) => a.id))}
            >
              <CheckCheck size={16} />
              Mark all as read
            </button>
            {profile?.role === "admin" && (
              <button
                className="button primary"
                onClick={() => setCompose(!compose)}
              >
                <Megaphone size={16} />
                Post announcement
              </button>
            )}
          </div>
        }
      />
      {compose && (
        <form
          className="panel compose-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await postAnnouncement(title.trim(), body.trim(), event || null);
              setTitle("");
              setBody("");
              setCompose(false);
              notify("Announcement posted.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Share a campus update</h2>
          <ErrorMessage message={error} />
          <div className="form-grid">
            <Field label="Title">
              <input
                required
                minLength={3}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What’s the news?"
              />
            </Field>
            <Field label="Audience">
              <select value={event} onChange={(e) => setEvent(e.target.value)}>
                <option value="">Everyone on campus</option>
                {events.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.title}
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
                  placeholder="Let the community know…"
                />
              </Field>
            </div>
          </div>
          <div className="form-footer">
            <span>
              Event announcements are visible to that event’s registrants.
            </span>
            <button className="button primary" disabled={busy}>
              <Send size={16} />
              {busy ? "Posting…" : "Publish announcement"}
            </button>
          </div>
        </form>
      )}
      <div className="page-tabs">
        <button
          className={tab === "all" ? "active" : ""}
          onClick={() => setTab("all")}
        >
          All updates <span>{announcements.length}</span>
        </button>
        <button
          className={tab === "unread" ? "active" : ""}
          onClick={() => setTab("unread")}
        >
          Unread <span>{unread.length}</span>
        </button>
      </div>
      <div className="announcements-list">
        {(tab === "unread" ? unread : announcements)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((a) => (
            <article
              className={
                "announcement-card panel " +
                (!read.includes(a.id) ? "unread" : "")
              }
              key={a.id}
            >
              <div
                className={
                  "announcement-icon " +
                  (a.event_id ? "pale-lilac" : "pale-green")
                }
              >
                {a.event_id ? <Bell size={22} /> : <Megaphone size={22} />}
              </div>
              <div>
                <div className="announcement-topline">
                  <span className="eyebrow">
                    {a.event_id ? "EVENT UPDATE" : "CAMPUS ANNOUNCEMENT"}
                  </span>
                  <time>
                    {dateLabel(a.created_at, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <h2>{a.title}</h2>
                <p className="preserve-lines">{a.body}</p>
                <div className="announcement-actions">
                  {a.event_id && (
                    <Link to={"/events/" + a.event_id} className="text-link">
                      View event <ArrowUpRight size={14} />
                    </Link>
                  )}
                  {!read.includes(a.id) && (
                    <button className="text-link" onClick={() => mark([a.id])}>
                      Mark as read <CheckCheck size={14} />
                    </button>
                  )}
                </div>
              </div>
              {!read.includes(a.id) && <span className="unread-dot" />}
            </article>
          ))}
        {(tab === "unread" ? unread : announcements).length === 0 && (
          <Empty
            title={
              tab === "unread"
                ? "You’re all caught up"
                : "A quiet moment on campus"
            }
            body="New campus updates will appear here. Check back soon."
          />
        )}
      </div>
    </>
  );
}
