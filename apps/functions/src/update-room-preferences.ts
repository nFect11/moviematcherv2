import type { RoomUpdatePreferencesInput } from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";

type UpdatePreferencesBody = RoomUpdatePreferencesInput;

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeNumberArray(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<number>();
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }
    deduped.add(Math.trunc(value));
  }

  return [...deduped];
}

function sanitizeCountry(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "";
}

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return options();
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const token = readBearerToken(event.headers);
    if (!token) {
      return json(401, { error: "Missing bearer token" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return json(401, { error: "Invalid token" });
    }

    const body = parseJsonBody<UpdatePreferencesBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    const supabase = getServiceClient();

    const [{ data: room, error: roomError }, { data: membership, error: membershipError }] =
      await Promise.all([
        supabase.from("rooms").select("id,status,host_user_id").eq("id", roomId).single(),
        supabase.from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle()
      ]);

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (room.status !== "lobby") {
      return json(409, { error: "Room has already started" });
    }

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    const isHost = room.host_user_id === user.id;

    const likedGenres = normalizeNumberArray(body.likedGenres);
    const dislikedGenres = normalizeNumberArray(body.dislikedGenres);
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      room_id: roomId,
      user_id: user.id,
      liked_genres: likedGenres,
      disliked_genres: dislikedGenres,
      updated_at: now
    };

    if (isHost) {
      if (Array.isArray(body.providers)) {
        const providers = [...new Set((body.providers as string[]).map((s) => s.trim()).filter(Boolean))];
        updateData.providers = providers;
      }

      const country = sanitizeCountry(body.country);
      if (country) {
        updateData.country = country;
      }
    }

    const { error: upsertError } = await supabase
      .from("room_preferences")
      .upsert(updateData, { onConflict: "room_id,user_id" });

    if (upsertError) {
      throw upsertError;
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("update-room-preferences error", error);
    return json(500, { error: "Internal server error" });
  }
};
