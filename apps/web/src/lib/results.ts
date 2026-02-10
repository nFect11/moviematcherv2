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

  const [{ data, error }, { data: finalChoice, error: finalChoiceError }] = await Promise.all([
    supabase
      .from("room_results")
      .select("tmdb_id,score_breakdown,decided_at")
      .eq("room_id", roomId)
      .returns<RoomResultRow[]>(),
    supabase
      .from("room_final_choices")
      .select("tmdb_id,resolution_method,tie_break_used")
      .eq("room_id", roomId)
      .maybeSingle<FinalChoiceRow>()
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (finalChoiceError) {
    throw new Error(finalChoiceError.message);
  }

  const results = (data ?? [])
    .map(toRoomResult)
    .sort((a, b) => (a.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER) - (b.scoreBreakdown.rank ?? Number.MAX_SAFE_INTEGER));

  return {
    winnerTmdbId: finalChoice?.tmdb_id ?? results.find((result) => result.scoreBreakdown.rank === 1)?.tmdbId ?? null,
    resolutionMethod: finalChoice?.resolution_method ?? null,
    tieBreakUsed: finalChoice?.tie_break_used ?? false,
    results
  };
}
