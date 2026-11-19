import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Save, UserRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useOrganizations } from "../contexts/OrganizationContext";
import { initials } from "../lib/utils";
import { uploadImage } from "../lib/upload";
import { PageTitle, Field, ErrorMessage } from "../components/Common";
export default function Profile() {
  const { profile, saveProfile, demo } = useAuth();
  const {
    organizations,
    memberships,
    loading: organizationsLoading,
  } = useOrganizations();
  const myOrganizations = organizations.filter(
    (organization) =>
      !organization.archived_at &&
      memberships.some(
        (membership) =>
          membership.organization_id === organization.id &&
          membership.student_id === profile?.id,
      ),
  );
  const notify = useToast();
  const [form, setForm] = useState({ ...profile! }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const set = (key: string, value: string | number | null) =>
    setForm((s) => ({ ...s, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.full_name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile({
        ...form,
        full_name: form.full_name.trim(),
        student_id: form.student_id.trim(),
      });
      notify("Your profile is up to date.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR CORNER OF CAMPUS"
        title="My profile"
        description="A few details that help your campus get to know you."
      />
      <div className="profile-layout">
        <aside className="panel profile-summary">
          <div className="avatar profile-avatar">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Profile" />
            ) : (
              initials(form.full_name)
            )}
          </div>
          <h2>{profile?.full_name}</h2>
          <p>{profile?.course}</p>
          <span className="success-badge">
            <ShieldCheck size={13} />
            {profile?.role === "admin"
              ? "Organizer account"
              : "Carolinian student"}
          </span>
          <div className="profile-summary-divider" />
          <p className="muted">University of San Carlos</p>
          <span className="small-copy">{profile?.student_id}</span>
          {demo && (
            <div className="demo-notice">
              <strong>Demo profile</strong>
              <p>These edits are saved in this browser only.</p>
            </div>
          )}
        </aside>
        <section className="panel profile-form">
          <div className="form-section-title">
            <UserRound size={20} />
            <div>
              <h2>Personal information</h2>
              <p>Keep your details current for event registration.</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <ErrorMessage message={error} />
            <div className="form-grid">
              <Field label="Full name">
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </Field>
              <Field label="Student ID">
                <input
                  required
                  maxLength={30}
                  value={form.student_id || ""}
                  onChange={(e) => set("student_id", e.target.value)}
                />
              </Field>
              <Field label="Course / program">
                <input
                  required
                  maxLength={120}
                  value={form.course}
                  placeholder="e.g. BS Computer Science"
                  onChange={(e) => set("course", e.target.value)}
                />
              </Field>
              <Field label="Year level">
                <select
                  required
                  value={form.year_level || ""}
                  onChange={(e) => set("year_level", Number(e.target.value))}
                >
                  <option value="">Select year</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Year {n}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="span-two">
                <Field
                  label="Profile photo"
                  hint="JPG, PNG, or WebP · Up to 2 MB (500 KB in demo)"
                >
                  <div className="upload-control">
                    <Camera size={20} />
                    <input
                      aria-label="Upload profile photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          set(
                            "avatar_url",
                            await uploadImage(file, "avatars", profile!.id),
                          );
                          notify("Photo ready. Save your profile to apply it.");
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </div>
                </Field>
              </div>
            </div>
            <div className="form-footer">
              <span>
                {uploading
                  ? "Uploading photo…"
                  : "Your role is managed by the university."}
              </span>
              <button disabled={busy || uploading} className="button primary">
                <Save size={16} />
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
          {profile?.role === "student" && (
            <section aria-labelledby="profile-memberships">
              <div className="profile-summary-divider" />
              <h2 id="profile-memberships" className="workflow-heading">
                My organizations
              </h2>
              {organizationsLoading ? (
                <p>Loading memberships...</p>
              ) : myOrganizations.length ? (
                <ul>
                  {myOrganizations.map((organization) => (
                    <li key={organization.id}>
                      <Link
                        to={"/organizations/" + organization.id}
                        className="text-link"
                      >
                        {organization.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No approved memberships yet.</p>
              )}
              <Link to="/organizations" className="text-link">
                Browse organizations
              </Link>
            </section>
          )}
        </section>
      </div>
    </>
  );
}
