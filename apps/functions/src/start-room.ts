import type { StartRoomInput } from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";
import { discoverMoviesMultiSource, fetchMovieDetails, sortCandidates } from "./_lib/tmdb";

type StartRoomBody = StartRoomInput;

interface RoomPreferenceRow {
  user_id: string;
  liked_genres: number[] | null;
  disliked_genres: number[] | null;
  providers: string[] | null;
  country: string | null;
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

function countGenres(values: number[][]) {
  const counts = new Map<number, number>();

  for (const genres of values) {
    for (const genre of genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return counts;
}

function pickTopGenres(counts: Map<number, number>, limit: number) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

function resolveRegionConfig(country: string | null | undefined) {
  const code = (country ?? "DE").trim().toUpperCase();
  const validRegions = new Set(["DE", "NL", "BE", "AT", "CH"]);
  return validRegions.has(code) ? code : "DE";
}

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
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

    const body = parseJsonBody<StartRoomBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, status, host_user_id")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (room.host_user_id !== user.id) {
      return json(403, { error: "Only the host can start the room" });
    }

    if (room.status !== "lobby") {
      return json(409, { error: "Room is not in lobby state" });
    }

    const { data: preferenceRows, error: preferencesError } = await supabase
      .from("room_preferences")
      .select("user_id,liked_genres,disliked_genres,providers,country")
      .eq("room_id", roomId)
      .returns<RoomPreferenceRow[]>();

    if (preferencesError || !preferenceRows?.length) {
      return json(409, { error: "Room has no preferences to seed candidate movies" });
    }

    const memberCount = preferenceRows.length;
    const likedLists = preferenceRows.map((row) => normalizeNumbers(row.liked_genres));
    const dislikedLists = preferenceRows.map((row) => normalizeNumbers(row.disliked_genres));

    const likedCounts = countGenres(likedLists);
    const dislikedCounts = countGenres(dislikedLists);

    const withGenres = pickTopGenres(likedCounts, 5);
    const withoutGenres = [...dislikedCounts.entries()]
      .filter(([, count]) => count / memberCount >= 0.5)
      .map(([genre]) => genre)
      .filter((genre) => !withGenres.includes(genre));

    const hostPreferences = preferenceRows.find((row) => row.user_id === room.host_user_id);
    const providerNames = (hostPreferences?.providers ?? []).filter(Boolean);
    const watchRegion = resolveRegionConfig(hostPreferences?.country);

    const discoveredMovies = sortCandidates(
      await discoverMoviesMultiSource({
        withGenres,
        withoutGenres,
        providerNames,
        watchRegion,
        language: "en-US",
        pages: 3,
        releaseDateGte: fiveYearsAgo(),
        voteAverageGte: 5.5,
        voteCountGte: 100
      })
    );

    const candidates: Array<{
      room_id: string;
      tmdb_id: number;
      metadata_snapshot: Record<string, unknown>;
      round_index: number;
    }> = discoveredMovies.slice(0, 50).map((movie, index) => ({
      room_id: roomId,
      tmdb_id: movie.id,
      metadata_snapshot: {
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        popularity: movie.popularity,
        genre_ids: movie.genre_ids,
        original_language: movie.original_language
      },
      round_index: index
    }));

    if (!candidates.length) {
      return json(502, { error: "No candidate movies returned from TMDB" });
    }

    // Enrich top 20 with TMDB details (runtime, trailers)
    const enrichCount = Math.min(20, candidates.length);
    const detailResults = await Promise.all(
      candidates.slice(0, enrichCount).map((c) =>
        fetchMovieDetails(c.tmdb_id, "en-US").catch(() => null)
      )
    );

    for (let i = 0; i < enrichCount; i += 1) {
      const detail = detailResults[i];
      if (!detail) {
        continue;
      }

      candidates[i].metadata_snapshot = {
        ...candidates[i].metadata_snapshot,
        runtime: detail.runtime,
        trailers: detail.trailers.slice(0, 3)
      };
    }

    await supabase.from("movie_candidates").delete().eq("room_id", roomId);

    const { error: candidateInsertError } = await supabase.from("movie_candidates").upsert(candidates, {
      onConflict: "room_id,tmdb_id"
    });

    if (candidateInsertError) {
      throw candidateInsertError;
    }

    const startedAt = new Date().toISOString();

    const { data: updatedRoom, error: updateError } = await supabase
      .from("rooms")
      .update({
        status: "active",
        started_at: startedAt
      })
      .eq("id", roomId)
      .eq("status", "lobby")
      .select("id, status, started_at")
      .single();

    if (updateError || !updatedRoom) {
      return json(409, { error: "Room was already started" });
    }

    try {
      const { data: lastEvent } = await supabase
        .from("room_events")
        .select("seq")
        .eq("room_id", roomId)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSeq = (lastEvent?.seq ?? 0) + 1;

      await supabase.from("room_events").insert({
        room_id: roomId,
        type: "room_started",
        payload: {
          started_by: user.id,
          candidate_count: candidates.length,
          with_genres: withGenres,
          without_genres: withoutGenres
        },
        seq: nextSeq
      });
    } catch (error) {
      console.warn("start-room: event insert failed", error);
    }

    return json(200, {
      roomId: updatedRoom.id,
      status: updatedRoom.status,
      startedAt: updatedRoom.started_at,
      candidateCount: candidates.length
    });
  } catch (error) {
    console.error("start-room error", error);
    return json(500, { error: "Internal server error" });
  }
};
