import { createClient } from "@supabase/supabase-js";

// Hardcoded defaults — new Supabase project (dyuafiidztsjnwqubqpd)
const DEFAULT_SUPABASE_URL = "https://dyuafiidztsjnwqubqpd.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWFmaWlkenRzam53cXVicXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjI2NzcsImV4cCI6MjEwNTY5ODY3N30.x-MaM4xj1On3b2fWAmiRuiSPKo9p6IfjEs9YYFU1uGY";

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
