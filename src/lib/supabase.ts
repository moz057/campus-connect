import { createClient } from "@supabase/supabase-js";
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const configured = Boolean(
  env.VITE_SUPABASE_URL?.startsWith("https://") &&
  env.VITE_SUPABASE_ANON_KEY &&
  !env.VITE_SUPABASE_URL.includes("YOUR_PROJECT"),
);
export const supabase = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
