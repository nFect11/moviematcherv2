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

      const score =
        preferredGenreMatches * 1.8 +
        learnedGenreMatches * 0.95 -
        blockedGenreMatches * 2.25 +
        socialLikeBoost -
        socialDislikePenalty -
        socialSkipPenalty +
        candidate.voteAverage * 0.05 +
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
