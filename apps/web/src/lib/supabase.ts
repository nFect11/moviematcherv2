import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseAuthStorageKey } from "./devSession";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          storageKey: resolveSupabaseAuthStorageKey(supabaseUrl)
        }
      })
    : null;
