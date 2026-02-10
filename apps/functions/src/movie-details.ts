import type { MovieDetailsInput } from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getUserFromToken } from "./_lib/supabase";
import { fetchMovieDetails } from "./_lib/tmdb";

type MovieDetailsBody = MovieDetailsInput;

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

    const body = parseJsonBody<MovieDetailsBody>(event.body);
    if (!body || typeof body.tmdbId !== "number" || !Number.isFinite(body.tmdbId)) {
      return json(400, { error: "Invalid tmdbId" });
    }

    const details = await fetchMovieDetails(Math.trunc(body.tmdbId));
    return json(200, details);
  } catch (error) {
    console.error("movie-details error", error);
    return json(500, { error: "Internal server error" });
  }
};
