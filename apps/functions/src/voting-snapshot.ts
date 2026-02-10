import type {
  RoomVotingAggregate,
  RoomVotingSnapshot,
  RoomVotingSnapshotInput,
  VoteChoice
} from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";

type VotingSnapshotBody = RoomVotingSnapshotInput;

interface CandidateRow {
  tmdb_id: number;
  round_index: number;
  metadata_snapshot: {
    title?: string;
    overview?: string;
    poster_path?: string | null;
    release_date?: string | null;
    vote_average?: number;
    genre_ids?: number[];
  };
}

interface VoteRow {
  tmdb_id: number;
  user_id: string;
  vote: VoteChoice;
  decided_at: string;
}

interface PreferenceRow {
  liked_genres: number[] | null;
  disliked_genres: number[] | null;
}

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeNumbers(values: number[] | null | undefined) {
  if (!values?.length) {
    return [];
  }

  const deduped = new Set<number>();
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    deduped.add(Math.trunc(value));
  }

  return [...deduped];
}

function buildAggregates(votes: VoteRow[]): RoomVotingAggregate[] {
  const buckets = new Map<number, RoomVotingAggregate>();

  for (const vote of votes) {
    const existing = buckets.get(vote.tmdb_id) ?? {
      tmdbId: vote.tmdb_id,
      likes: 0,
      dislikes: 0,
      skips: 0,
      totalDecisions: 0
    };

    if (vote.vote === "like") {
      existing.likes += 1;
    } else if (vote.vote === "dislike") {
      existing.dislikes += 1;
    } else {
      existing.skips += 1;
    }

    existing.totalDecisions += 1;
    buckets.set(vote.tmdb_id, existing);
  }

  return [...buckets.values()];
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

    const body = parseJsonBody<VotingSnapshotBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    const supabase = getServiceClient();

    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    const [{ data: candidates, error: candidatesError }, { data: votes, error: votesError }, { data: preferences, error: preferencesError }] =
      await Promise.all([
        supabase
          .from("movie_candidates")
          .select("tmdb_id,round_index,metadata_snapshot")
          .eq("room_id", roomId)
          .order("round_index", { ascending: true })
          .returns<CandidateRow[]>(),
        supabase
          .from("votes")
          .select("tmdb_id,user_id,vote,decided_at")
          .eq("room_id", roomId)
          .returns<VoteRow[]>(),
        supabase
          .from("room_preferences")
          .select("liked_genres,disliked_genres")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle<PreferenceRow>()
      ]);

    if (candidatesError) {
      throw candidatesError;
    }

    if (votesError) {
      throw votesError;
    }

    if (preferencesError) {
      throw preferencesError;
    }

    const allVotes = votes ?? [];
    const userVotes = allVotes.filter((vote) => vote.user_id === user.id);

    const response: RoomVotingSnapshot = {
      candidates: (candidates ?? []).map((candidate) => ({
        tmdbId: candidate.tmdb_id,
        title: candidate.metadata_snapshot.title ?? "Untitled",
        overview: candidate.metadata_snapshot.overview ?? "",
        posterPath: candidate.metadata_snapshot.poster_path ?? null,
        releaseDate: candidate.metadata_snapshot.release_date ?? null,
        voteAverage: candidate.metadata_snapshot.vote_average ?? 0,
        genreIds: candidate.metadata_snapshot.genre_ids ?? [],
        roundIndex: candidate.round_index
      })),
      userVotes: userVotes.map((vote) => ({
        tmdbId: vote.tmdb_id,
        vote: vote.vote,
        decidedAt: vote.decided_at
      })),
      aggregates: buildAggregates(allVotes),
      preferenceProfile: {
        likedGenres: normalizeNumbers(preferences?.liked_genres),
        dislikedGenres: normalizeNumbers(preferences?.disliked_genres)
      }
    };

    return json(200, response);
  } catch (error) {
    console.error("voting-snapshot error", error);
    return json(500, { error: "Internal server error" });
  }
};
