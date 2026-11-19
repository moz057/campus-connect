import { useEffect, useRef, useState } from "react";
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
import { Field, ErrorMessage, Loading } from "../components/Common";
import { supabase } from "../lib/supabase";

type AuthLocationState = {
  from?: string;
  confirmationError?: string;
  confirmed?: boolean;
};

const invalidConfirmation =
  "This confirmation link could not be verified. Log in if your account is already confirmed, or request a new link.";
export default function Auth() {
  const { profile, demo, signIn, signUp, resendConfirmation, demoLogin } =
    useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const signup = location.pathname === "/register";
  const authState = location.state as AuthLocationState | null;
  const emailInput = useRef<HTMLInputElement>(null);
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const errorCode = fragment.get("error_code") ?? query.get("error_code");
  const linkError = [fragment, query].some((params) =>
    ["error", "error_code", "error_description"].some((key) => params.has(key)),
  );
  const code = query.get("code");
  const callback =
    location.pathname === "/auth/callback" ||
    (location.pathname === "/login" &&
      (linkError || Boolean(code) || fragment.has("access_token")));
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [studentId, setStudentId] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const destination = authState?.from || "/events";
  const confirmationError = authState?.confirmationError;
  useEffect(() => {
    if (!callback) return;
    let active = true;
    async function completeConfirmation() {
      let message = invalidConfirmation;
      if (errorCode === "otp_expired") {
        message =
          "This confirmation link has expired or has already been used. Log in if you already confirmed your account, or request a new link.";
      } else if (!linkError && supabase) {
        try {
          // The SDK consumes URL credentials during initialization.
          const { error } = await supabase.auth.initialize();
          const { data, error: sessionError } =
            await supabase.auth.getSession();
          const codeStillPresent =
            code && new URLSearchParams(window.location.search).has("code");
          if (!error && !sessionError && !codeStillPresent && data.session)
            message = "";
        } catch {
          // A failed callback can be retried from the login screen.
        }
      }
      if (active) {
        navigate("/login", {
          replace: true,
          state: {
            from: destination,
            confirmationError: message,
            confirmed: !message,
          },
        });
      }
    }
    void completeConfirmation();
    return () => {
      active = false;
    };
  }, [callback, code, destination, errorCode, linkError, navigate]);
  useEffect(() => {
    if (profile && !demo && !callback && !confirmationError) {
      navigate(destination, { replace: true });
    }
  }, [profile, demo, callback, confirmationError, navigate, destination]);

  async function requestConfirmation() {
    if (!emailInput.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await resendConfirmation(email.trim());
      setSuccess(
        "If your account is awaiting confirmation, check your inbox for a new link.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
      } else {
        await signIn(email.trim(), password);
        if (confirmationError)
          navigate("/login", { replace: true, state: { from: destination } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (callback) return <Loading />;

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
            <ErrorMessage message={error || confirmationError || ""} />
            {(success || authState?.confirmed) && (
              <div className="success-message" role="status">
                {success || "Email confirmed. You can now log in."}
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
                ref={emailInput}
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
            {!signup && !demo && (
              <button
                type="button"
                className="button full-width"
                disabled={busy}
                onClick={requestConfirmation}
              >
                Resend confirmation email
              </button>
            )}
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
