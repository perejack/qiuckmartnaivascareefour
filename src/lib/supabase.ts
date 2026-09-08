import { createClient } from "@supabase/supabase-js";

// Hardcoded defaults for quick testing (e.g. Vercel previews).
// NOTE: Only use the ANON key here. Never expose the service role key in frontend code.
const DEFAULT_SUPABASE_URL = "https://mmizjhxxajhooslhyafb.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1taXpqaHh4YWpob29zbGh5YWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mzg2MTUsImV4cCI6MjA5NTQxNDYxNX0.pPIuFP7GwkQ2k4PtlmZr0IMxIbLsIqa50ehbmrvRQ-w";

function getSafeSupabaseUrl(): string {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    try {
      new URL(envUrl);
      return envUrl;
    } catch {
      // ignore
    }
  }
  return DEFAULT_SUPABASE_URL;
}

function getSafeSupabaseAnonKey(): string {
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (envKey && envKey.length > 20 && !/placeholder|your_/i.test(envKey)) {
    return envKey;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export const supabase = createClient(getSafeSupabaseUrl(), getSafeSupabaseAnonKey(), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
