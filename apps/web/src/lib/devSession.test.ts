import {
  resolveDevSessionScope,
  resolveSupabaseAuthStorageKey,
  sanitizeDevSession,
  withDevSessionScope
} from "./devSession";
import { describe, expect, it } from "vitest";

describe("devSession utilities", () => {
  it("sanitizes session values", () => {
    expect(sanitizeDevSession(" Host User !! ")).toBe("hostuser");
    expect(sanitizeDevSession("A".repeat(80))).toHaveLength(32);
  });

  it("resolves dev_session scope from query string", () => {
    expect(resolveDevSessionScope("?dev_session=Host_1")).toBe("host_1");
    expect(resolveDevSessionScope("?dev_session=   ")).toBeNull();
    expect(resolveDevSessionScope("?foo=bar")).toBeNull();
    expect(resolveDevSessionScope("")).toBeNull();
  });

  it("applies session scope to custom keys", () => {
    expect(withDevSessionScope("mm-session", "?dev_session=u1")).toBe("mm-session-u1");
    expect(withDevSessionScope("mm-session", "?foo=bar")).toBe("mm-session");
  });

  it("builds a supabase auth storage key and scopes it by dev_session", () => {
    expect(resolveSupabaseAuthStorageKey("https://abc123.supabase.co", "")).toBe("sb-abc123-auth-token");
    expect(resolveSupabaseAuthStorageKey("https://abc123.supabase.co", "?dev_session=host")).toBe(
      "sb-abc123-auth-token-host"
    );
    expect(resolveSupabaseAuthStorageKey("not-a-url", "?dev_session=host")).toBe("sb-auth-token-host");
  });
});
