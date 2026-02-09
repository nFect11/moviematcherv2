import { getServiceClient, getUserFromToken } from "./_lib/supabase";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import type { RoomJoinInput } from "@moviematcher/shared";

type JoinRoomBody = RoomJoinInput;

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

    const body = parseJsonBody<JoinRoomBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const nickname = body.nickname?.trim();
    if (!nickname || nickname.length < 2 || nickname.length > 30) {
      return json(400, { error: "Nickname must be between 2 and 30 characters" });
    }

    const roomCode = body.roomCode?.trim().toUpperCase();
    if (!roomCode || roomCode.length !== 6) {
      return json(400, { error: "Room code must have 6 characters" });
    }

    const preferredGenres = normalizeNumberArray(body.preferredGenres);
    const blockedGenres = normalizeNumberArray(body.blockedGenres);

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, status, host_user_id")
      .eq("code", roomCode)
      .single();

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (room.status !== "lobby") {
      return json(409, { error: "Room has already started" });
    }

    const { error: memberError } = await supabase.from("room_members").upsert(
      {
        room_id: room.id,
        user_id: user.id,
        nickname,
        connected: true,
        last_seen_at: new Date().toISOString()
      },
      {
        onConflict: "room_id,user_id"
      }
    );

    if (memberError) {
      throw memberError;
    }

    const { error: preferenceError } = await supabase.from("room_preferences").upsert(
      {
        room_id: room.id,
        user_id: user.id,
        liked_genres: preferredGenres,
        disliked_genres: blockedGenres,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "room_id,user_id"
      }
    );

    if (preferenceError) {
      throw preferenceError;
    }

    return json(200, {
      roomId: room.id,
      roomCode: room.code,
      userId: user.id,
      role: room.host_user_id === user.id ? "host" : "member"
    });
  } catch (error) {
    console.error("join-room error", error);
    return json(500, { error: "Internal server error" });
  }
};
