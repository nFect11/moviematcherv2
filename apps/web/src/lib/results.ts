import type { FinalResolutionMethod, RoomResult, RoomResultScoreBreakdown, RoomResultsSnapshot } from "@moviematcher/shared";
import { supabase } from "./supabase";

interface RoomResultRow {
  tmdb_id: number;
  score_breakdown: RoomResultScoreBreakdown;
  decided_at: string;
}

interface FinalChoiceRow {
  tmdb_id: number;
  resolution_method: FinalResolutionMethod;
  tie_break_used: boolean;
}

interface FinalVoteRow {
  user_id: string;
  tmdb_id: number;
}

interface RoomMemberRow {
  user_id: string;
  nickname: string;
}

function toRoomResult(
  row: RoomResultRow,
  votesByMovie: Map<number, string[]>
): RoomResult {
  const voters = votesByMovie.get(row.tmdb_id) ?? [];

  return {
    tmdbId: row.tmdb_id,
    decidedAt: row.decided_at,
    scoreBreakdown: row.score_breakdown,
    voters,
    finalVoteCount: voters.length
  };
}

export async function fetchRoomResults(roomId: string): Promise<RoomResultsSnapshot> {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const [
    { data, error },
    { data: finalChoice, error: finalChoiceError },
    { data: finalVotes, error: finalVotesError },
    { data: members, error: membersError }
  ] = await Promise.all([
    supabase
      .from("room_results")
      .select("tmdb_id,score_breakdown,decided_at")
      .eq("room_id", roomId)
      .returns<RoomResultRow[]>(),
    supabase
      .from("room_final_choices")
      .select("tmdb_id,resolution_method,tie_break_used")
      .eq("room_id", roomId)
      .maybeSingle<FinalChoiceRow>(),
    supabase
      .from("room_result_votes")
      .select("user_id,tmdb_id")
      .eq("room_id", roomId)
      .returns<FinalVoteRow[]>(),
    supabase
      .from("room_members")
      .select("user_id,nickname")
      .eq("room_id", roomId)
      .returns<RoomMemberRow[]>()
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (finalChoiceError) {
    throw new Error(finalChoiceError.message);
  }

  if (finalVotesError) {
    throw new Error(finalVotesError.message);
  }

  if (membersError) {
    throw new Error(membersError.message);
  }

  const nicknameByUserId = new Map((members ?? []).map((member) => [member.user_id, member.nickname]));
  const votesByMovie = new Map<number, string[]>();
  for (const vote of finalVotes ?? []) {
    const nickname = nicknameByUserId.get(vote.user_id) ?? "Anonymous";
    const existing = votesByMovie.get(vote.tmdb_id);
    if (existing) {
      existing.push(nickname);
      continue;
    }

    votesByMovie.set(vote.tmdb_id, [nickname]);
  }

  const results = (data ?? [])
    .map((row) => toRoomResult(row, votesByMovie))
    .sort((a, b) => (a.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER) - (b.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER));

  return {
    winnerTmdbId: finalChoice?.tmdb_id ?? results.find((result) => result.scoreBreakdown.rank === 1)?.tmdbId ?? null,
    resolutionMethod: finalChoice?.resolution_method ?? null,
    tieBreakUsed: finalChoice?.tie_break_used ?? false,
    results
  };
}
