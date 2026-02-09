import { supabase } from "./supabase";

export async function ensureAnonymousSession() {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session?.access_token) {
    return {
      userId: sessionData.session.user.id,
      accessToken: sessionData.session.access_token
    };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error("Could not create anonymous session");
  }

  return {
    userId: data.session.user.id,
    accessToken: data.session.access_token
  };
}
