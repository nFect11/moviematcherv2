import type {
  FinalVoteContender,
  FinalVoteSnapshot,
  FinalVoteSnapshotInput,
  RoomResultScoreBreakdown
} from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";

type FinalVoteSnapshotBody = FinalVoteSnapshotInput;

interface RoomRow {
  id: string;
  status: "lobby" | "active" | "final_voting" | "finished";
}

interface FinalContenderRow {
  tmdb_id: number;
  rank: number;
  score_breakdown: RoomResultScoreBreakdown;
}

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapContenders(rows: FinalContenderRow[]): FinalVoteContender[] {
  return rows
    .map((row) => ({
      tmdbId: row.tmdb_id,
      rank: row.rank,
      scoreBreakdown: row.score_breakdown
    }))
    .sort((left, right) => left.rank - right.rank);
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

    const body = parseJsonBody<FinalVoteSnapshotBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    const supabase = getServiceClient();

    const [{ data: room, error: roomError }, { data: membership, error: membershipError }] = await Promise.all([
      supabase.from("rooms").select("id,status").eq("id", roomId).single<RoomRow>(),
      supabase.from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle()
    ]);

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    if (room.status !== "final_voting" && room.status !== "finished") {
      return json(409, { error: "Room is not in final voting state" });
    }

    const [
      { data: contenders, error: contendersError },
      { data: allVotes, error: allVotesError },
      { data: ownVote, error: ownVoteError },
      { data: members, error: membersError },
      { data: finalChoice, error: finalChoiceError }
    ] = await Promise.all([
      supabase
        .from("room_final_contenders")
        .select("tmdb_id,rank,score_breakdown")
        .eq("room_id", roomId)
        .order("rank", { ascending: true })
        .returns<FinalContenderRow[]>(),
      supabase.from("room_result_votes").select("user_id").eq("room_id", roomId),
      supabase.from("room_result_votes").select("tmdb_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle(),
      supabase.from("room_members").select("user_id").eq("room_id", roomId),
      supabase
        .from("room_final_choices")
        .select("tmdb_id,resolution_method,tie_break_used")
        .eq("room_id", roomId)
        .maybeSingle()
    ]);

    if (contendersError) {
      throw contendersError;
    }

    if (allVotesError) {
      throw allVotesError;
    }

    if (ownVoteError) {
      throw ownVoteError;
    }

    if (membersError) {
      throw membersError;
    }

    if (finalChoiceError) {
      throw finalChoiceError;
    }

    const totalVoters = members?.length ?? 0;
    const votesSubmitted = allVotes?.length ?? 0;
    const votingComplete = Boolean(finalChoice) || (totalVoters > 0 && votesSubmitted >= totalVoters);

    const response: FinalVoteSnapshot = {
      roomId,
      status: room.status,
      contenders: mapContenders(contenders ?? []),
      totalVoters,
      votesSubmitted,
      hasVoted: Boolean(ownVote),
      selectedTmdbId: ownVote?.tmdb_id ?? null,
      votingComplete,
      winnerTmdbId: finalChoice?.tmdb_id ?? null,
      resolutionMethod: finalChoice?.resolution_method ?? null,
      tieBreakUsed: Boolean(finalChoice?.tie_break_used)
    };

    return json(200, response);
  } catch (error) {
    console.error("final-vote-snapshot error", error);
    return json(500, { error: "Internal server error" });
  }
};
