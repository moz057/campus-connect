import { useEffect, useRef, useState } from "react";
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
  UserRoundPen,
  Users,
  Building2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useOrganizations } from "../contexts/OrganizationContext";
import { useToast } from "../contexts/ToastContext";
import { initials } from "../lib/utils";
export default function Layout() {
  const { profile, demo, signOut } = useAuth();
  const { announcements, error, refresh } = useData();
  const {
    organizations,
    leading,
    organizer,
    scope,
    setScope,
    notifications,
    announcementReads,
  } = useOrganizations();
  const notify = useToast();
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [accountMenuKey, setAccountMenuKey] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const mobileClose = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const location = useLocation(),
    navigate = useNavigate();
  const accountMenuOpen = Boolean(profile) && accountMenuKey === location.key;
  useEffect(() => {
    if (!accountMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !accountMenu.current?.contains(event.target)
      ) {
        setAccountMenuKey(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuKey(null);
        accountTrigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!mobile) return;
    mobileClose.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
      }
    }
    const viewport = window.matchMedia?.("(max-width: 640px)");
    function closeOnResize(event: MediaQueryListEvent) {
      if (!event.matches) setMobile(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    viewport?.addEventListener("change", closeOnResize);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      viewport?.removeEventListener("change", closeOnResize);
    };
  }, [mobile]);
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/events") {
      setQuery(new URLSearchParams(location.search).get("q") ?? "");
    }
  }, [location.pathname, location.search]);

  function closeMobile() {
    setMobile(false);
    requestAnimationFrame(() => mobileTrigger.current?.focus());
  }

  async function logOut() {
    setSigningOut(true);
    try {
      await signOut();
      setAccountMenuKey(null);
      navigate("/login", { replace: true });
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setSigningOut(false);
    }
  }
  const links = [
    { to: "/events", label: "Discover events", icon: Compass },
    { to: "/calendar", label: "Event calendar", icon: CalendarDays },
    { to: "/registrations", label: "My registrations", icon: Ticket },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/organizations", label: "Organizations", icon: Building2 },
  ];
  const readIds = new Set(
    announcementReads.map((read) => read.announcement_id),
  );
  const unread =
    notifications.filter((n) => !n.read_at).length +
    announcements.filter((a) => !readIds.has(a.id)).length;
  const admin = profile?.role === "admin";
  const showScope =
    organizer &&
    ["/admin", "/admin/attendance", "/admin/reports"].includes(
      location.pathname,
    );
  const section = location.pathname.startsWith("/admin")
    ? "Organizer workspace"
    : links.find((l) => location.pathname.startsWith(l.to))?.label ||
      (location.pathname === "/profile" ? "My profile" : "Discover events");
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closeMobile}
        />
      )}
      <aside
        id="campus-navigation"
        aria-label="Campus navigation"
        className={"sidebar " + (mobile ? "is-open" : "")}
      >
        <Link
          to="/"
          className="brand"
          onClick={() => {
            if (mobile) closeMobile();
          }}
        >
          <span className="brand-mark">
            <GraduationCap size={25} strokeWidth={1.8} />
          </span>
          <span>
            Campus<span className="brand-connect">Connect</span>
            <small>UNIVERSITY OF SAN CARLOS</small>
          </span>
        </Link>
        <button
          type="button"
          className="mobile-close icon-button"
          ref={mobileClose}
          aria-label="Close navigation"
          onClick={closeMobile}
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
              onClick={() => {
                if (mobile) closeMobile();
              }}
              className={({ isActive }) =>
                "nav-item " +
                (isActive || (to === "/events" && location.pathname === "/")
                  ? "active"
                  : "")
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Notifications" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        {organizer && (
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
                ...(admin
                  ? [
                      {
                        to: "/admin/organizations",
                        label: "Manage organizations",
                        icon: Building2,
                      },
                    ]
                  : []),
              ].map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  end={to === "/admin"}
                  to={to}
                  onClick={() => {
                    if (mobile) closeMobile();
                  }}
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
        {profile && (
          <NavLink
            className="nav-item"
            to="/leadership"
            onClick={() => {
              if (mobile) closeMobile();
            }}
          >
            <Users size={19} />
            Leadership
          </NavLink>
        )}
        <div className="sidebar-bottom">
          <div className="organizer-callout">
            <span className="tiny-stars">
              <Sparkles size={19} />
            </span>
            <strong>Bring your ideas to life.</strong>
            <p>Your organization. Your next big event.</p>
            <Link to={organizer ? "/admin/events/new" : "/organizers"}>
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
      <div className="main-shell" inert={mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              type="button"
              className="icon-button mobile-menu"
              ref={mobileTrigger}
              aria-label="Open navigation"
              aria-expanded={mobile}
              aria-controls="campus-navigation"
              onClick={() => {
                setAccountMenuKey(null);
                setMobile(true);
              }}
            >
              <Menu size={22} />
            </button>
            {profile && (
              <div className="account-menu" ref={accountMenu}>
                <button
                  type="button"
                  className="header-profile"
                  ref={accountTrigger}
                  aria-label="Account options"
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-options"
                  onClick={() =>
                    setAccountMenuKey(accountMenuOpen ? null : location.key)
                  }
                >
                  <span className="avatar small">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      initials(profile.full_name)
                    )}
                  </span>
                  <ChevronDown size={13} aria-hidden="true" />
                </button>
                <div
                  className="account-options"
                  id="account-options"
                  hidden={!accountMenuOpen}
                >
                  <Link to="/profile" onClick={() => setAccountMenuKey(null)}>
                    <UserRoundPen size={16} aria-hidden="true" />
                    Edit profile
                  </Link>
                  <button
                    type="button"
                    className="account-logout"
                    disabled={signingOut}
                    onClick={logOut}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    {signingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              </div>
            )}
            <span>My campus</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                const params = new URLSearchParams(
                  location.pathname === "/" || location.pathname === "/events"
                    ? location.search
                    : "",
                );
                if (query.trim()) params.set("q", query.trim());
                else params.delete("q");
                navigate({ pathname: "/events", search: params.toString() });
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search campus events"
                placeholder="Search campus events"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            {!demo && leading.length > 0 && (
              <span className="demo-pill">Student Leader</span>
            )}
            {demo && (
              <Link to="/login" className="demo-pill">
                Demo{" "}
                <span>
                  {admin
                    ? "University Admin"
                    : leading.length
                      ? "Student Leader"
                      : "Student"}
                </span>
                <ChevronDown size={12} />
              </Link>
            )}
            <Link
              to="/notifications"
              className="notification-button"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            {!profile && (
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
          {showScope && (
            <label className="workspace-scope">
              Organization
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                {admin && <option value="">All campus events</option>}
                {(admin ? organizations : leading).map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                    {organization.archived_at ? " (archived)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Outlet />
        </main>
        <footer className="site-footer">
          <span>Made for the Carolinian community.</span>
          <span>
            CampusConnect <i /> University of San Carlos
          </span>
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
