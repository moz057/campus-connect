import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isAuthApiError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { DemoRole, Profile } from "../lib/types";
import { useToast } from "./ToastContext";
import { demoProfile } from "../data/demo";
interface AuthValue {
  profile: Profile | null;
  loading: boolean;
  demo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    full_name: string,
    student_id: string,
  ) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  demoLogin: (role: DemoRole) => void;
}
const AuthContext = createContext<AuthValue>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  // Demo identities never interact with Supabase or grant production permissions.
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (supabase) return null;
    try {
      const saved = localStorage.getItem("cc-session");
      return saved === null ? demoProfile : JSON.parse(saved);
    } catch {
      return demoProfile;
    }
  });
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async (id?: string) => {
      try {
        if (!id) {
          if (active) setProfile(null);
          return;
        }
        const { data, error } = await supabase!
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        if (active) setProfile(data);
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => load(data.session?.user.id))
      .catch(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void load(session?.user.id);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!supabase) {
      try {
        localStorage.setItem("cc-session", JSON.stringify(profile));
      } catch {
        notify(
          "Browser storage is full. Your profile changes may not persist.",
          true,
        );
      }
    }
  }, [profile]);
  async function signIn(email: string, password: string) {
    if (!supabase)
      throw Error(
        "Use a demo account below, or connect Supabase to enable real sign-in.",
      );
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }
  async function signUp(
    email: string,
    password: string,
    full_name: string,
    student_id: string,
  ) {
    if (!supabase)
      throw Error(
        "Connect Supabase to create real accounts. You can explore with a demo account below.",
      );
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, student_id },
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });
    const duplicateError =
      isAuthApiError(error) &&
      (error.code === "user_already_exists" || error.code === "email_exists");
    // Supabase can return a masked user with no identities for a duplicate signup.
    if (duplicateError || (!error && data.user?.identities?.length === 0)) {
      throw Error("An account already exists for this email. Log in instead.");
    }
    if (error) throw error;
    return Boolean(data.session);
  }
  async function resendConfirmation(email: string) {
    if (!supabase) throw Error("Connect Supabase to send confirmation emails.");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/auth/callback" },
    });
    if (error) throw error;
  }
  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setProfile(null);
  }
  async function saveProfile(p: Partial<Profile>) {
    if (!profile) throw Error("Please log in.");
    const {
      full_name,
      student_id,
      course,
      year_level,
      organization,
      avatar_url,
    } = p;
    const safe = {
      full_name,
      student_id,
      course,
      year_level,
      organization,
      avatar_url,
    };
    if (supabase) {
      const { error } = await supabase
        .from("profiles")
        .update(safe)
        .eq("id", profile.id);
      if (error) throw error;
    }
    setProfile({ ...profile, ...safe } as Profile);
  }
  function demoLogin(role: DemoRole) {
    if (supabase) return;
    setProfile({
      ...demoProfile,
      ...(role === "admin"
        ? {
            id: "demo-admin",
            full_name: "Jamie Garcia",
            student_id: "USC-STAFF",
            organization: "Student Affairs Office",
          }
        : role === "leader"
          ? {
              id: "demo-leader",
              full_name: "Sam Villanueva",
              student_id: "23104999",
            }
          : {}),
      role: role === "admin" ? "admin" : "student",
    });
  }
  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        demo: !supabase,
        signIn,
        signUp,
        resendConfirmation,
        signOut,
        saveProfile,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
