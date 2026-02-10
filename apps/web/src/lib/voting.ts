import type { MovieCandidate, RoomVotingSnapshot, VoteChoice } from "@moviematcher/shared";
import { submitDecision } from "./api";
import { supabase } from "./supabase";

interface MovieCandidateRow {
  tmdb_id: number;
  metadata_snapshot: {
    title?: string;
    overview?: string;
    poster_path?: string | null;
    release_date?: string | null;
    vote_average?: number;
    genre_ids?: number[];
  };
  round_index: number;
}

interface VoteRow {
  tmdb_id: number;
  vote: VoteChoice;
  decided_at: string;
}

function mapCandidate(row: MovieCandidateRow): MovieCandidate {
  return {
    tmdbId: row.tmdb_id,
    title: row.metadata_snapshot.title ?? "Untitled",
    overview: row.metadata_snapshot.overview ?? "",
    posterPath: row.metadata_snapshot.poster_path ?? null,
    releaseDate: row.metadata_snapshot.release_date ?? null,
    voteAverage: row.metadata_snapshot.vote_average ?? 0,
    genreIds: row.metadata_snapshot.genre_ids ?? [],
    roundIndex: row.round_index
  };
}

export async function fetchRoomVotingSnapshot(roomId: string, userId: string): Promise<RoomVotingSnapshot> {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const [{ data: candidates, error: candidateError }, { data: votes, error: votesError }] = await Promise.all([
    supabase
      .from("movie_candidates")
      .select("tmdb_id,metadata_snapshot,round_index")
      .eq("room_id", roomId)
      .order("round_index", { ascending: true })
      .returns<MovieCandidateRow[]>(),
    supabase
      .from("votes")
      .select("tmdb_id,vote,decided_at")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .returns<VoteRow[]>()
  ]);

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  if (votesError) {
    throw new Error(votesError.message);
  }

  return {
    candidates: (candidates ?? []).map(mapCandidate),
    userVotes: (votes ?? []).map((vote) => ({
      tmdbId: vote.tmdb_id,
      vote: vote.vote,
      decidedAt: vote.decided_at
    }))
  };
}

export async function submitVote(payload: { roomId: string; userId: string; tmdbId: number; vote: VoteChoice }) {
  await submitDecision({
    roomId: payload.roomId,
    tmdbId: payload.tmdbId,
    vote: payload.vote
  });
}

export function subscribeToVotingChanges(roomId: string, userId: string, onChange: () => void): () => void {
  const client = supabase;
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel(`voting-sync:${roomId}:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "movie_candidates", filter: `room_id=eq.${roomId}` }, onChange)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId},user_id=eq.${userId}` },
      onChange
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function toPosterUrl(path: string | null) {
  if (!path) {
    return null;
  }

  return `https://image.tmdb.org/t/p/w500${path}`;
}
