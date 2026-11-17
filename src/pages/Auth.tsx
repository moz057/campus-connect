import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Field, ErrorMessage } from "../components/Common";
export default function Auth() {
  const { profile, demo, signIn, signUp, demoLogin } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const signup = location.pathname === "/register";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [studentId, setStudentId] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const destination =
    (location.state as { from?: string } | null)?.from || "/events";
  useEffect(() => {
    if (profile && !demo) navigate(destination, { replace: true });
  }, [profile, demo, navigate, destination]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        const active = await signUp(
          email.trim(),
          password,
          name.trim(),
          studentId.trim(),
        );
        if (!active)
          setSuccess(
            "Check your email to confirm your account, then return here to log in.",
          );
      } else await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <GraduationCap size={27} />
          </span>
          <span>
            CampusConnect<small>UNIVERSITY OF SAN CARLOS</small>
          </span>
        </Link>
        <div>
          <span className="hero-kicker">A LITTLE MORE CONNECTED.</span>
          <h1>
            Your campus.
            <br />
            Your people.
            <br />
            Your next chapter.
          </h1>
          <p>
            One place for everything that brings
            <br />
            the Carolinian community together.
          </p>
          <span className="auth-art-star">✳</span>
        </div>
        <small>Scientia · Virtus · Devotio</small>
      </div>
      <div className="auth-form-side">
        <Link className="back-link" to="/events">
          <ArrowLeft size={16} />
          Back to campus
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">HELLO, CAROLINIAN</span>
          <h1>{signup ? "Your community is waiting." : "Welcome back."}</h1>
          <p>
            {signup
              ? "Create your account and make the most of campus life."
              : "A new campus experience is just around the corner."}
          </p>
          {demo && (
            <div className="demo-notice">
              <strong>You’re exploring the demo.</strong>
              <p>
                Real accounts become available after connecting your Supabase
                project. Choose a demo role below to try the app.
              </p>
            </div>
          )}
          <form onSubmit={submit}>
            <ErrorMessage message={error} />
            {success && (
              <div className="success-message" role="status">
                {success}
              </div>
            )}
            {signup && (
              <>
                <Field label="Full name">
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </Field>
                <Field label="Student ID">
                  <input
                    required
                    maxLength={30}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 23104567"
                  />
                </Field>
              </>
            )}
            <Field label="University email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@usc.edu.ph"
              />
            </Field>
            <Field
              label="Password"
              hint={signup ? "At least 8 characters." : ""}
            >
              <span className="password-input">
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            <button className="button primary full-width" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already a Carolinian here?" : "New to CampusConnect?"}{" "}
            <Link
              to={signup ? "/login" : "/register"}
              state={{ from: destination }}
              onClick={() => {
                setError("");
                setSuccess("");
              }}
            >
              {signup ? "Log in" : "Create an account"}
            </Link>
          </p>
          {demo && (
            <>
              <div className="or-divider">
                <span />
                EXPLORE THE DEMO
                <span />
              </div>
              <div className="demo-roles">
                <button
                  onClick={() => {
                    demoLogin("student");
                    navigate(destination);
                  }}
                >
                  <Compass size={21} />
                  <strong>Student</strong>
                  <span>
                    Discover & register
                    <ArrowRight size={13} />
                  </span>
                </button>
                <button
                  onClick={() => {
                    demoLogin("admin");
                    navigate("/admin");
                  }}
                >
                  <ShieldCheck size={21} />
                  <strong>Organizer</strong>
                  <span>
                    Manage & connect
                    <ArrowRight size={13} />
                  </span>
                </button>
              </div>
              <p className="demo-disclaimer">
                Sample data is saved only in this browser.
              </p>
            </>
          )}
          <p className="auth-footnote">
            <ShieldCheck size={14} /> Your campus account. Your personal space.
          </p>
        </div>
      </div>
    </div>
  );
}
