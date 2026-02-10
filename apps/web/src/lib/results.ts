import type { RoomResult, RoomResultScoreBreakdown, RoomResultsSnapshot } from "@moviematcher/shared";
import { supabase } from "./supabase";

interface RoomResultRow {
  tmdb_id: number;
  score_breakdown: RoomResultScoreBreakdown;
  decided_at: string;
}

function toRoomResult(row: RoomResultRow): RoomResult {
  return {
    tmdbId: row.tmdb_id,
    decidedAt: row.decided_at,
    scoreBreakdown: row.score_breakdown
  };
}

export async function fetchRoomResults(roomId: string): Promise<RoomResultsSnapshot> {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await supabase
    .from("room_results")
    .select("tmdb_id,score_breakdown,decided_at")
    .eq("room_id", roomId)
    .returns<RoomResultRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const results = (data ?? [])
    .map(toRoomResult)
    .sort((a, b) => (a.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER) - (b.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER));

  return {
    winnerTmdbId: results.find((result) => result.scoreBreakdown.rank === 1)?.tmdbId ?? null,
    results
  };
}
