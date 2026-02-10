interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

interface TmdbProviderResponse {
  results: TmdbProvider[];
}

interface TmdbDiscoverMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
}

interface TmdbDiscoverResponse {
  page: number;
  total_pages: number;
  results: TmdbDiscoverMovie[];
}

interface TmdbVideoResult {
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
}

interface TmdbMovieDetailsResponse {
  id: number;
  title: string;
  overview: string;
  release_date: string | null;
  runtime: number | null;
  videos?: {
    results?: TmdbVideoResult[];
  };
}

export interface MovieDetailsResult {
  tmdbId: number;
  title: string;
  overview: string;
  releaseDate: string | null;
  runtime: number | null;
  trailers: {
    name: string;
    key: string;
    site: string;
    type: string;
    official: boolean;
  }[];
}

export interface DiscoverMovieFilters {
  withGenres?: number[];
  withoutGenres?: number[];
  providerNames?: string[];
  language?: string;
  watchRegion?: string;
  pages?: number;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getApiKey() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TMDB_API_KEY");
  }

  return apiKey;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function tmdbGet<TResponse>(path: string, searchParams: URLSearchParams) {
  const apiKey = getApiKey();
  const params = new URLSearchParams(searchParams);
  params.set("api_key", apiKey);

  const response = await fetch(`${TMDB_BASE_URL}${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as TResponse;
}

async function resolveProviderIds(providerNames: string[], watchRegion: string) {
  if (!providerNames.length) {
    return [];
  }

  const providerResponse = await tmdbGet<TmdbProviderResponse>("/watch/providers/movie", new URLSearchParams({ watch_region: watchRegion }));

  const byName = new Map<string, number>();
  for (const provider of providerResponse.results) {
    byName.set(normalizeText(provider.provider_name), provider.provider_id);
  }

  const ids = new Set<number>();
  for (const name of providerNames) {
    const normalized = normalizeText(name);
    if (!normalized) {
      continue;
    }

    const direct = byName.get(normalized);
    if (direct) {
      ids.add(direct);
      continue;
    }

    for (const [catalogName, providerId] of byName.entries()) {
      if (catalogName.includes(normalized) || normalized.includes(catalogName)) {
        ids.add(providerId);
        break;
      }
    }
  }

  return [...ids];
}

export async function discoverMovies(filters: DiscoverMovieFilters) {
  const language = filters.language ?? "en-US";
  const watchRegion = filters.watchRegion ?? "US";
  const pageCount = Math.max(1, Math.min(filters.pages ?? 3, 5));

  const withGenres = (filters.withGenres ?? []).filter((value) => Number.isFinite(value));
  const withoutGenres = (filters.withoutGenres ?? []).filter((value) => Number.isFinite(value));
  const providerNames = (filters.providerNames ?? []).filter(Boolean);

  const providerIds = await resolveProviderIds(providerNames, watchRegion);

  const today = new Date().toISOString().slice(0, 10);
  const moviesById = new Map<number, TmdbDiscoverMovie>();

  for (let page = 1; page <= pageCount; page += 1) {
    const params = new URLSearchParams({
      language,
      include_adult: "false",
      include_video: "false",
      sort_by: "popularity.desc",
      page: String(page),
      "vote_count.gte": "50",
      "release_date.lte": today
    });

    if (withGenres.length) {
      params.set("with_genres", withGenres.join("|"));
    }

    if (withoutGenres.length) {
      params.set("without_genres", withoutGenres.join("|"));
    }

    if (providerIds.length) {
      params.set("watch_region", watchRegion);
      params.set("with_watch_providers", providerIds.join("|"));
      params.set("with_watch_monetization_types", "flatrate");
    }

    const response = await tmdbGet<TmdbDiscoverResponse>("/discover/movie", params);
    for (const movie of response.results) {
      moviesById.set(movie.id, movie);
    }
  }

  return [...moviesById.values()];
}

export async function fetchMovieDetails(tmdbId: number, language = "en-US"): Promise<MovieDetailsResult> {
  const response = await tmdbGet<TmdbMovieDetailsResponse>(
    `/movie/${tmdbId}`,
    new URLSearchParams({
      language,
      append_to_response: "videos"
    })
  );

  const trailers = (response.videos?.results ?? []).filter((video) => video.site === "YouTube" && video.type === "Trailer");

  return {
    tmdbId: response.id,
    title: response.title,
    overview: response.overview ?? "",
    releaseDate: response.release_date,
    runtime: response.runtime,
    trailers: trailers.map((video) => ({
      name: video.name,
      key: video.key,
      site: video.site,
      type: video.type,
      official: video.official
    }))
  };
}
