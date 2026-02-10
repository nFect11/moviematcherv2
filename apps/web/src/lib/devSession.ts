const DEV_SESSION_PARAM = "dev_session";
const DEV_SESSION_MAX_LENGTH = 32;
const DEFAULT_SUPABASE_AUTH_STORAGE_KEY = "sb-auth-token";

export function sanitizeDevSession(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, DEV_SESSION_MAX_LENGTH);
}

export function resolveDevSessionScope(search?: string) {
  const query = search ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!query) {
    return null;
  }

  const rawValue = new URLSearchParams(query).get(DEV_SESSION_PARAM);
  if (!rawValue) {
    return null;
  }

  const sanitized = sanitizeDevSession(rawValue);
  return sanitized || null;
}

export function withDevSessionScope(baseKey: string, search?: string) {
  const scope = resolveDevSessionScope(search);
  if (!scope) {
    return baseKey;
  }

  return `${baseKey}-${scope}`;
}

export function resolveSupabaseAuthStorageKey(supabaseUrl: string, search?: string) {
  let baseKey = DEFAULT_SUPABASE_AUTH_STORAGE_KEY;

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    if (projectRef) {
      baseKey = `sb-${projectRef}-auth-token`;
    }
  } catch {
    // Fallback to default storage key when URL parsing fails.
  }

  return withDevSessionScope(baseKey, search);
}
