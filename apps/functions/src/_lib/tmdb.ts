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
  releaseDateGte?: string;
  releaseDateLte?: string;
  voteAverageGte?: number;
  voteCountGte?: number;
  withRuntimeGte?: number;
  withRuntimeLte?: number;
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

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildDiscoverParams(filters: DiscoverMovieFilters, defaults?: { sort_by?: string }) {
  const language = filters.language ?? "en-US";
  const params = new URLSearchParams({
    language,
    include_adult: "false",
    include_video: "false",
    sort_by: defaults?.sort_by ?? "popularity.desc",
    "vote_count.gte": String(filters.voteCountGte ?? 100),
    "release_date.lte": filters.releaseDateLte ?? todayISO()
  });

  if (filters.releaseDateGte) {
    params.set("release_date.gte", filters.releaseDateGte);
  }

  if (filters.voteAverageGte !== undefined) {
    params.set("vote_average.gte", String(filters.voteAverageGte));
  }

  if (filters.withRuntimeGte !== undefined) {
    params.set("with_runtime.gte", String(filters.withRuntimeGte));
  }

  if (filters.withRuntimeLte !== undefined) {
    params.set("with_runtime.lte", String(filters.withRuntimeLte));
  }

  return params;
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

function applyGenreAndProviderParams(params: URLSearchParams, filters: DiscoverMovieFilters, providerIds: number[], watchRegion: string) {
  const withGenres = (filters.withGenres ?? []).filter((value) => Number.isFinite(value));
  const withoutGenres = (filters.withoutGenres ?? []).filter((value) => Number.isFinite(value));

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
}

async function fetchPaginatedResults(filters: DiscoverMovieFilters, providerIds: number[], watchRegion: string, extraParams: { sort_by: string }) {
  const pageCount = Math.max(1, Math.min(filters.pages ?? 2, 5));
  const moviesById = new Map<number, TmdbDiscoverMovie>();

  for (let page = 1; page <= pageCount; page += 1) {
    const params = buildDiscoverParams(filters, { sort_by: extraParams.sort_by });
    params.set("page", String(page));
    applyGenreAndProviderParams(params, filters, providerIds, watchRegion);

    const response = await tmdbGet<TmdbDiscoverResponse>("/discover/movie", params);
    for (const movie of response.results) {
      moviesById.set(movie.id, movie);
    }
  }

  return [...moviesById.values()];
}

function computeRecencyScore(releaseDate: string | null) {
  if (!releaseDate) {
    return 0.5;
  }

  const releaseYear = Number(releaseDate.slice(0, 4));
  if (!Number.isFinite(releaseYear)) {
    return 0.5;
  }

  const currentYear = new Date().getFullYear();
  const age = currentYear - releaseYear;

  if (age <= 2) {
    return 1.0;
  }

  if (age <= 5) {
    return 0.8;
  }

  if (age <= 10) {
    return 0.5;
  }

  return 0.25;
}

function normalizeVoteAverage(voteAverage: number) {
  if (!Number.isFinite(voteAverage)) {
    return 0;
  }

  return Math.max(0, Math.min(10, voteAverage)) / 10;
}

function normalizePopularity(popularity: number) {
  if (!Number.isFinite(popularity)) {
    return 0;
  }

  return Math.min(popularity / 1000, 1);
}

export function sortCandidates(movies: TmdbDiscoverMovie[]) {
  return movies
    .map((movie) => {
      const recency = computeRecencyScore(movie.release_date);
      const quality = normalizeVoteAverage(movie.vote_average);
      const popularity = normalizePopularity(movie.popularity);

      const score = recency * 0.4 + quality * 0.35 + popularity * 0.25;

      return { movie, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.movie);
}

export async function discoverMoviesMultiSource(filters: DiscoverMovieFilters) {
  const watchRegion = filters.watchRegion ?? "US";
  const providerNames = (filters.providerNames ?? []).filter(Boolean);
  const providerIds = await resolveProviderIds(providerNames, watchRegion);

  const [discoverResults, nowPlayingResults, topRatedResults] = await Promise.all([
    fetchPaginatedResults(filters, providerIds, watchRegion, { sort_by: "popularity.desc" }).catch(() => [] as TmdbDiscoverMovie[]),
    fetchNowPlaying(watchRegion, filters.language).catch(() => [] as TmdbDiscoverMovie[]),
    fetchTopRated(watchRegion, filters.language).catch(() => [] as TmdbDiscoverMovie[])
  ]);

  const merged = new Map<number, TmdbDiscoverMovie>();
  for (const movie of discoverResults) {
    merged.set(movie.id, movie);
  }

  for (const movie of nowPlayingResults) {
    if (!merged.has(movie.id)) {
      merged.set(movie.id, movie);
    }
  }

  for (const movie of topRatedResults) {
    if (!merged.has(movie.id)) {
      merged.set(movie.id, movie);
    }
  }

  return [...merged.values()];
}

async function fetchNowPlaying(watchRegion: string, language = "en-US") {
  const moviesById = new Map<number, TmdbDiscoverMovie>();

  for (let page = 1; page <= 2; page += 1) {
    const params = new URLSearchParams({
      language,
      page: String(page),
      region: watchRegion
    });

    const response = await tmdbGet<TmdbDiscoverResponse>("/movie/now_playing", params);
    for (const movie of response.results) {
      moviesById.set(movie.id, movie);
    }
  }

  return [...moviesById.values()];
}

async function fetchTopRated(watchRegion: string, language = "en-US") {
  const moviesById = new Map<number, TmdbDiscoverMovie>();

  for (let page = 1; page <= 2; page += 1) {
    const params = new URLSearchParams({
      language,
      page: String(page),
      region: watchRegion
    });

    const response = await tmdbGet<TmdbDiscoverResponse>("/movie/top_rated", params);
    for (const movie of response.results) {
      moviesById.set(movie.id, movie);
    }
  }

  return [...moviesById.values()];
}

export async function discoverMovies(filters: DiscoverMovieFilters) {
  const watchRegion = filters.watchRegion ?? "US";
  const providerNames = (filters.providerNames ?? []).filter(Boolean);
  const providerIds = await resolveProviderIds(providerNames, watchRegion);

  return fetchPaginatedResults(filters, providerIds, watchRegion, { sort_by: "popularity.desc" });
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
