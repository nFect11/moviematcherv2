import type { RefetchCandidatesInput } from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";
import { discoverMovies, sortCandidates } from "./_lib/tmdb";

type RefetchBody = RefetchCandidatesInput;

interface VoteRow {
  tmdb_id: number;
  vote: string;
}

interface CandidateRow {
  tmdb_id: number;
  round_index: number;
  metadata_snapshot: {
    genre_ids?: number[];
    release_date?: string | null;
    vote_average?: number;
    runtime?: number | null;
    original_language?: string | null;
    popularity?: number;
  };
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

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function extractYear(releaseDate: string | null | undefined) {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

interface TasteVector {
  withGenres: number[];
  withoutGenres: number[];
  releaseDateGte: string | null;
  withRuntimeLte: number | null;
  withRuntimeGte: number | null;
  minVoteAverage: number;
}

function buildTasteVector(
  userVotes: VoteRow[],
  candidates: CandidateRow[],
  preferences: PreferenceRow | null
): TasteVector {
  const candidateById = new Map(candidates.map((c) => [c.tmdb_id, c]));
  const likedGenres = normalizeNumbers(preferences?.liked_genres);
  const dislikedGenres = normalizeNumbers(preferences?.disliked_genres);

  // Count votes per genre
  const genreLikes = new Map<number, number>();
  const genreDislikes = new Map<number, number>();
  let totalLikes = 0;
  let totalDislikes = 0;
  const likedYears: number[] = [];
  const likedRuntimes: number[] = [];
  const likedLanguages = new Map<string, number>();

  for (const vote of userVotes) {
    const candidate = candidateById.get(vote.tmdb_id);
    if (!candidate) {
      continue;
    }

    const genres = candidate.metadata_snapshot.genre_ids ?? [];

    if (vote.vote === "like") {
      totalLikes += 1;
      for (const g of genres) {
        genreLikes.set(g, (genreLikes.get(g) ?? 0) + 1);
      }

      const year = extractYear(candidate.metadata_snapshot.release_date);
      if (year !== null) {
        likedYears.push(year);
      }

      const runtime = candidate.metadata_snapshot.runtime;
      if (runtime !== null && runtime !== undefined && Number.isFinite(runtime)) {
        likedRuntimes.push(runtime);
      }

      const lang = candidate.metadata_snapshot.original_language;
      if (lang) {
        likedLanguages.set(lang, (likedLanguages.get(lang) ?? 0) + 1);
      }
    } else if (vote.vote === "dislike") {
      totalDislikes += 1;
      for (const g of genres) {
        genreDislikes.set(g, (genreDislikes.get(g) ?? 0) + 1);
      }
    }
  }

  // Compute per-genre weights
  const genreWeight = new Map<number, number>();
  const allGenreIds = new Set([...genreLikes.keys(), ...genreDislikes.keys(), ...likedGenres, ...dislikedGenres]);

  for (const g of allGenreIds) {
    let weight = 0;
    if (likedGenres.includes(g)) {
      weight += 1.0;
    }

    if (totalLikes > 0) {
      weight += ((genreLikes.get(g) ?? 0) / totalLikes) * 2.5;
    }

    if (totalDislikes > 0) {
      weight -= ((genreDislikes.get(g) ?? 0) / totalDislikes) * 2.0;
    }

    if (dislikedGenres.includes(g)) {
      weight -= 3.0;
    }

    genreWeight.set(g, weight);
  }

  const withGenres: number[] = [];
  const withoutGenres: number[] = [];

  for (const [g, w] of genreWeight) {
    if (w >= 0.3) {
      withGenres.push(g);
    } else if (w <= -0.5) {
      withoutGenres.push(g);
    }
  }

  // If no clear signal, fall back to preferences
  if (withGenres.length === 0 && likedGenres.length > 0) {
    withGenres.push(...likedGenres.slice(0, 5));
  }

  if (withoutGenres.length === 0 && dislikedGenres.length > 0) {
    withoutGenres.push(...dislikedGenres.slice(0, 5));
  }

  // Recency bias
  let releaseDateGte: string | null = null;
  if (likedYears.length >= 3) {
    const avgYear = Math.round(likedYears.reduce((s, y) => s + y, 0) / likedYears.length);
    if (avgYear >= 2022) {
      releaseDateGte = `${avgYear - 1}-01-01`;
    }
  }

  // Runtime bias
  let withRuntimeLte: number | null = null;
  let withRuntimeGte: number | null = null;
  if (likedRuntimes.length >= 2) {
    const avgRuntime = Math.round(likedRuntimes.reduce((s, r) => s + r, 0) / likedRuntimes.length);
    if (avgRuntime < 100) {
      withRuntimeLte = 110;
    } else if (avgRuntime > 140) {
      withRuntimeGte = 110;
    }
  }

  return {
    withGenres,
    withoutGenres,
    releaseDateGte,
    withRuntimeLte,
    withRuntimeGte,
    minVoteAverage: 5.0
  };
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

    const body = parseJsonBody<RefetchBody>(event.body);
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
        supabase.from("rooms").select("id,status").eq("id", roomId).single(),
        supabase.from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle()
      ]);

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (room.status !== "active") {
      return json(409, { error: "Room is not active" });
    }

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    const [{ data: userVotes, error: votesError }, { data: candidates, error: candidatesError }, { data: preferences, error: preferencesError }] =
      await Promise.all([
        supabase.from("votes").select("tmdb_id,vote").eq("room_id", roomId).eq("user_id", user.id).returns<VoteRow[]>(),
        supabase
          .from("movie_candidates")
          .select("tmdb_id,round_index,metadata_snapshot")
          .eq("room_id", roomId)
          .returns<CandidateRow[]>(),
        supabase
          .from("room_preferences")
          .select("liked_genres,disliked_genres")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle<PreferenceRow>()
      ]);

    if (votesError) {
      throw votesError;
    }

    if (candidatesError) {
      throw candidatesError;
    }

    if (preferencesError) {
      throw preferencesError;
    }

    const taste = buildTasteVector(userVotes ?? [], candidates ?? [], preferences ?? null);

    // If too few votes to learn, don't refetch
    const voteCount = (userVotes ?? []).length;
    if (voteCount < 3) {
      return json(200, { newTmdbIds: [], reason: "insufficient_data" });
    }

    // Get host preferences for providers/region
    const { data: roomData } = await supabase
      .from("rooms")
      .select("host_user_id")
      .eq("id", roomId)
      .single<{ host_user_id: string }>();

    const hostUserId = roomData?.host_user_id ?? "";

    const { data: hostPrefs } = await supabase
      .from("room_preferences")
      .select("providers,country")
      .eq("room_id", roomId)
      .eq("user_id", hostUserId)
      .maybeSingle<{ providers: string[] | null; country: string | null }>();

    const providerNames = (hostPrefs?.providers ?? []).filter(Boolean);
    const watchRegion = (hostPrefs?.country ?? "DE").toUpperCase();

    const discovered = sortCandidates(
      await discoverMovies({
        withGenres: taste.withGenres.length > 0 ? taste.withGenres : undefined,
        withoutGenres: taste.withoutGenres.length > 0 ? taste.withoutGenres : undefined,
        providerNames: providerNames.length > 0 ? providerNames : undefined,
        watchRegion,
        language: "en-US",
        pages: 2,
        releaseDateGte: taste.releaseDateGte ?? undefined,
        voteAverageGte: taste.minVoteAverage,
        voteCountGte: 80,
        withRuntimeGte: taste.withRuntimeGte ?? undefined,
        withRuntimeLte: taste.withRuntimeLte ?? undefined
      })
    );

    const existingIds = new Set((candidates ?? []).map((c) => c.tmdb_id));
    const newMovies = discovered.filter((m) => !existingIds.has(m.id)).slice(0, 15);

    if (newMovies.length === 0) {
      return json(200, { newTmdbIds: [], reason: "no_new_candidates" });
    }

    const maxRoundIndex = (candidates ?? []).reduce((max, c) => Math.max(max, c.round_index), 0);

    const toInsert = newMovies.map((movie, index) => ({
      room_id: roomId,
      tmdb_id: movie.id,
      metadata_snapshot: {
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        popularity: movie.popularity,
        genre_ids: movie.genre_ids,
        original_language: movie.original_language
      },
      round_index: maxRoundIndex + 1 + index
    }));

    const { error: insertError } = await supabase.from("movie_candidates").upsert(toInsert, {
      onConflict: "room_id,tmdb_id"
    });

    if (insertError) {
      throw insertError;
    }

    return json(200, {
      newTmdbIds: newMovies.map((m) => m.id),
      reason: "taste_adapted"
    });
  } catch (error) {
    console.error("refetch-candidates error", error);
    return json(500, { error: "Internal server error" });
  }
};
