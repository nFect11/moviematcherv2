import type { MovieCandidate, RoomVotingAggregate, UserPreferenceProfile, VoteChoice } from "@moviematcher/shared";

type SwipeDecision = VoteChoice | "skip";

function overlapCount(source: number[], target: Set<number>) {
  let count = 0;
  for (const value of source) {
    if (target.has(value)) {
      count += 1;
    }
  }
  return count;
}

function computeRecencyScore(releaseDate: string | null) {
  if (!releaseDate) {
    return 0.5;
  }

  const year = Number(releaseDate.slice(0, 4));
  if (!Number.isFinite(year)) {
    return 0.5;
  }

  const age = new Date().getFullYear() - year;
  if (age <= 2) {
    return 1.0;
  }

  if (age <= 5) {
    return 0.8;
  }

  if (age <= 10) {
    return 0.5;
  }

  return 0.2;
}

function normalizePopularity(popularity: number) {
  if (!Number.isFinite(popularity)) {
    return 0;
  }

  return Math.min(popularity / 1000, 1);
}

function runtimeBonus(runtime: number | null, preferredRange: "short" | "long" | null) {
  if (runtime === null || !Number.isFinite(runtime) || !preferredRange) {
    return 0;
  }

  if (preferredRange === "short" && runtime < 100) {
    return 0.6;
  }

  if (preferredRange === "long" && runtime > 130) {
    return 0.6;
  }

  return 0;
}

export function rankCandidatesForUser({
  candidates,
  reactionByMovie,
  aggregates,
  preferenceProfile
}: {
  candidates: MovieCandidate[];
  reactionByMovie: Record<number, SwipeDecision>;
  aggregates: RoomVotingAggregate[];
  preferenceProfile: UserPreferenceProfile;
}) {
  const likedGenres = new Set(preferenceProfile.likedGenres);
  const dislikedGenres = new Set(preferenceProfile.dislikedGenres);

  const candidateById = new Map(candidates.map((candidate) => [candidate.tmdbId, candidate]));

  const likedGenrePool = new Set<number>();
  const likedRuntimes: number[] = [];
  const likedLanguages = new Set<string>();

  for (const [tmdbId, decision] of Object.entries(reactionByMovie)) {
    if (decision !== "like") {
      continue;
    }

    const candidate = candidateById.get(Number(tmdbId));
    if (!candidate) {
      continue;
    }

    for (const genreId of candidate.genreIds) {
      likedGenrePool.add(genreId);
    }

    if (candidate.runtime !== null && Number.isFinite(candidate.runtime)) {
      likedRuntimes.push(candidate.runtime as number);
    }

    if (candidate.language) {
      likedLanguages.add(candidate.language);
    }
  }

  // Determine runtime preference
  let preferredRuntime: "short" | "long" | null = null;
  if (likedRuntimes.length >= 2) {
    const avg = likedRuntimes.reduce((s, r) => s + r, 0) / likedRuntimes.length;
    if (avg < 100) {
      preferredRuntime = "short";
    } else if (avg > 140) {
      preferredRuntime = "long";
    }
  }

  const aggregateById = new Map(aggregates.map((aggregate) => [aggregate.tmdbId, aggregate]));

  const undecidedCandidates = candidates.filter((candidate) => !reactionByMovie[candidate.tmdbId]);

  return undecidedCandidates
    .map((candidate) => {
      const aggregate = aggregateById.get(candidate.tmdbId);

      const preferredGenreMatches = overlapCount(candidate.genreIds, likedGenres);
      const blockedGenreMatches = overlapCount(candidate.genreIds, dislikedGenres);
      const learnedGenreMatches = overlapCount(candidate.genreIds, likedGenrePool);

      const socialLikeBoost = aggregate?.likes ? 5 + aggregate.likes * 1.6 : 0;
      const socialDislikePenalty = aggregate?.dislikes ? aggregate.dislikes * 1.05 : 0;
      const socialSkipPenalty = aggregate?.skips ? aggregate.skips * 0.28 : 0;

      const recency = computeRecencyScore(candidate.releaseDate);
      const popularity = normalizePopularity(candidate.popularity);
      const runtimePref = runtimeBonus(candidate.runtime, preferredRuntime);
      const languageMatch = candidate.language && likedLanguages.has(candidate.language) ? 0.4 : 0;

      const score =
        preferredGenreMatches * 1.8 +
        learnedGenreMatches * 0.95 -
        blockedGenreMatches * 2.25 +
        socialLikeBoost -
        socialDislikePenalty -
        socialSkipPenalty +
        candidate.voteAverage * 0.05 +
        recency * 0.35 +
        popularity * 0.15 +
        runtimePref +
        languageMatch +
        (1000 - candidate.roundIndex) * 0.0001;

      return {
        candidate,
        score
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.candidate.roundIndex - b.candidate.roundIndex;
    })
    .map((entry) => entry.candidate);
}
