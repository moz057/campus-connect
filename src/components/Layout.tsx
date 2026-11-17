import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Compass,
  CalendarDays,
  Ticket,
  Bell,
  LayoutDashboard,
  ClipboardCheck,
  ChartNoAxesCombined,
  GraduationCap,
  Search,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
  Users,
  Code2,
  HeartHandshake,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { initials } from "../lib/utils";
export default function Layout() {
  const { profile, demo, signOut } = useAuth();
  const { announcements, error, refresh } = useData();
  const notify = useToast();
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation(),
    navigate = useNavigate();
  const links = [
    { to: "/events", label: "Discover events", icon: Compass },
    { to: "/calendar", label: "Event calendar", icon: CalendarDays },
    { to: "/registrations", label: "My registrations", icon: Ticket },
    { to: "/notifications", label: "Announcements", icon: Bell },
  ];
  const [, setReadRevision] = useState(0);
  useEffect(() => {
    const update = () => setReadRevision((n) => n + 1);
    window.addEventListener("cc-read", update);
    return () => window.removeEventListener("cc-read", update);
  }, []);
  const readIds: string[] = JSON.parse(
    localStorage.getItem("cc-read-" + (profile?.id || "guest")) || "[]",
  );
  const unread = announcements.filter((a) => !readIds.includes(a.id)).length;
  const section = location.pathname.startsWith("/admin")
    ? "Organizer workspace"
    : links.find((l) => location.pathname.startsWith(l.to))?.label ||
      (location.pathname === "/profile" ? "My profile" : "Discover events");
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <Link to="/" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            <GraduationCap size={25} strokeWidth={1.8} />
          </span>
          <span>
            Campus<span className="brand-connect">Connect</span>
            <small>UNIVERSITY OF SAN CARLOS</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="workspace-label">
          <span className="live-dot" /> The Carolinian community
        </div>
        <div className="nav-section-label">YOUR CAMPUS</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                "nav-item " +
                (isActive || (to === "/events" && location.pathname === "/")
                  ? "active"
                  : "")
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Announcements" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="nav-section-label organization-label">
          EXPLORE ORGANIZATIONS
        </div>
        <Link
          className="organization-link"
          to="/events?organization=Computer"
          onClick={() => setMobile(false)}
        >
          <span className="org-icon lilac">
            <Code2 size={15} />
          </span>
          CIS Council
          <ArrowUpRight size={13} />
        </Link>
        <Link
          className="organization-link"
          to="/events?organization=Supreme"
          onClick={() => setMobile(false)}
        >
          <span className="org-icon peach">
            <Users size={15} />
          </span>
          Student Council
          <ArrowUpRight size={13} />
        </Link>
        <Link
          className="organization-link"
          to="/events?organization=Community"
          onClick={() => setMobile(false)}
        >
          <span className="org-icon mint">
            <HeartHandshake size={15} />
          </span>
          Community Extension
          <ArrowUpRight size={13} />
        </Link>
        {profile?.role === "admin" && (
          <>
            <div className="nav-section-label organization-label">
              ORGANIZER TOOLS
            </div>
            <nav>
              {[
                { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
                {
                  to: "/admin/attendance",
                  label: "Manage attendance",
                  icon: ClipboardCheck,
                },
                {
                  to: "/admin/reports",
                  label: "Event reports",
                  icon: ChartNoAxesCombined,
                },
              ].map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  end={to === "/admin"}
                  to={to}
                  onClick={() => setMobile(false)}
                  className={({ isActive }) =>
                    "nav-item " + (isActive ? "active" : "")
                  }
                >
                  <Icon size={19} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="organizer-callout">
            <span className="tiny-stars">
              <Sparkles size={19} />
            </span>
            <strong>Bring your ideas to life.</strong>
            <p>Your organization. Your next big event.</p>
            <Link
              to={
                profile?.role === "admin" ? "/admin/events/new" : "/organizers"
              }
            >
              Organize an event <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="university-lockup">
            <span className="university-seal">
              <GraduationCap size={21} />
            </span>
            <span>
              University of San Carlos<small>Scientia · Virtus · Devotio</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>My campus</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/events?q=" + encodeURIComponent(query));
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search campus events"
                placeholder="Search anything…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            {demo && (
              <Link to="/login" className="demo-pill">
                Demo{" "}
                <span>
                  {profile?.role === "admin" ? "Organizer" : "Student"}
                </span>
                <ChevronDown size={12} />
              </Link>
            )}
            <Link
              to="/notifications"
              className="notification-button"
              aria-label={`${unread} unread announcements`}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            {profile ? (
              <Link to="/profile" className="header-profile">
                <span className="avatar small">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    initials(profile.full_name)
                  )}
                </span>
                <ChevronDown size={13} />
              </Link>
            ) : (
              <Link className="button primary small-button" to="/login">
                Log in
              </Link>
            )}
          </div>
        </header>
        <main className="page-content">
          {error && (
            <div className="error-message" role="alert">
              Could not refresh campus data: {error}
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="site-footer">
          <span>Made for the Carolinian community.</span>
          <span>
            CampusConnect <i /> University of San Carlos
          </span>
          {profile && (
            <button
              onClick={async () => {
                try {
                  await signOut();
                  navigate("/login");
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <LogOut size={13} /> Log out
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
export function OrganizerInfo() {
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">MAKE IT HAPPEN</span>
          <h1>Great events start with you.</h1>
          <p>
            Bring your student organization’s next idea to the Carolinian
            community.
          </p>
        </div>
      </div>
      <div className="panel prose">
        <GraduationCap size={38} className="green-text" />
        <h2>Become a CampusConnect organizer</h2>
        <p>
          Organizer accounts can publish events, manage registrations, scan
          tickets, share announcements, and export attendance reports.
        </p>
        <p>
          Contact the University of San Carlos Student Affairs Office through
          your usual university channel to request access. An authorized
          administrator assigns organizer roles.
        </p>
        <Link to="/events" className="button primary">
          Explore campus events
        </Link>
      </div>
    </>
  );
}
