import { getServiceClient, getUserFromToken } from "./_lib/supabase";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import type { RoomCreateInput } from "@moviematcher/shared";

type CreateRoomBody = RoomCreateInput;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length = 6) {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    result += ROOM_CODE_ALPHABET[index];
  }
  return result;
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

    const body = parseJsonBody<CreateRoomBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const nickname = body.nickname?.trim();
    if (!nickname || nickname.length < 2 || nickname.length > 30) {
      return json(400, { error: "Nickname must be between 2 and 30 characters" });
    }

    const supabase = getServiceClient();

    let roomId: string | null = null;
    let roomCode: string | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateRoomCode();
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          code,
          host_user_id: user.id,
          status: "lobby"
        })
        .select("id, code")
        .single();

      if (!error && data) {
        roomId = data.id;
        roomCode = data.code;
        break;
      }

      if (error?.code !== "23505") {
        throw error;
      }
    }

    if (!roomId || !roomCode) {
      return json(500, { error: "Could not allocate unique room code" });
    }

    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      nickname,
      connected: true
    });

    if (memberError) {
      await supabase.from("rooms").delete().eq("id", roomId);
      throw memberError;
    }

    return json(200, {
      roomId,
      roomCode,
      userId: user.id,
      role: "host"
    });
  } catch (error) {
    console.error("create-room error", error);
    return json(500, { error: "Internal server error" });
  }
};
