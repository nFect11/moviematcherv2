import type { SubmitDecisionInput, VoteChoice } from "@moviematcher/shared";
import { evaluateAndFinalizeRoom } from "./_lib/room-scoring";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";

type SubmitDecisionBody = SubmitDecisionInput;

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toVoteWeight(vote: VoteChoice) {
  if (vote === "like") {
    return 1;
  }

  if (vote === "dislike") {
    return -0.9;
  }

  return -0.15;
}

function isVoteChoice(value: unknown): value is VoteChoice {
  return value === "like" || value === "dislike" || value === "skip";
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

    const body = parseJsonBody<SubmitDecisionBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    if (!Number.isFinite(body.tmdbId)) {
      return json(400, { error: "Invalid TMDB ID" });
    }

    if (!isVoteChoice(body.vote)) {
      return json(400, { error: "Invalid vote choice" });
    }

    const supabase = getServiceClient();

    const [{ data: room, error: roomError }, { data: membership, error: membershipError }, { data: candidate, error: candidateError }] =
      await Promise.all([
        supabase.from("rooms").select("id,status").eq("id", roomId).single(),
        supabase.from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle(),
        supabase
          .from("movie_candidates")
          .select("tmdb_id")
          .eq("room_id", roomId)
          .eq("tmdb_id", Math.trunc(body.tmdbId))
          .maybeSingle()
      ]);

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (room.status === "final_voting") {
      return json(409, { error: "Room moved to final voting" });
    }

    if (room.status !== "active") {
      return json(409, { error: "Room is not active" });
    }

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    if (candidateError || !candidate) {
      return json(404, { error: "Movie candidate not found in this room" });
    }

    const decidedAt = new Date().toISOString();
    const { error: voteError } = await supabase.from("votes").upsert(
      {
        room_id: roomId,
        user_id: user.id,
        tmdb_id: Math.trunc(body.tmdbId),
        vote: body.vote,
        weight: toVoteWeight(body.vote),
        decided_at: decidedAt
      },
      {
        onConflict: "room_id,user_id,tmdb_id"
      }
    );

    if (voteError) {
      throw voteError;
    }

    const evaluation = await evaluateAndFinalizeRoom(supabase, roomId, user.id);

    return json(200, {
      roomId,
      status: evaluation.status,
      finished: evaluation.finished,
      winnerTmdbId: evaluation.winnerTmdbId
    });
  } catch (error) {
    console.error("submit-decision error", error);
    return json(500, { error: "Internal server error" });
  }
};
