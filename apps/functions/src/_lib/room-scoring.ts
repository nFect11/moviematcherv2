import type { VoteChoice } from "@moviematcher/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RoomRow {
  id: string;
  status: "lobby" | "active" | "finished";
}

interface CandidateMetadataSnapshot {
  title?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number;
}

interface CandidateRow {
  tmdb_id: number;
  round_index: number;
  metadata_snapshot: CandidateMetadataSnapshot;
}

interface VoteRow {
  tmdb_id: number;
  user_id: string;
  vote: VoteChoice;
}

interface MemberRow {
  user_id: string;
}

interface RankedScoreBreakdown {
  rank: number;
  score: number;
  baseScore: number;
  likes: number;
  dislikes: number;
  skips: number;
  decidedCount: number;
  memberCount: number;
  decisionCoverage: number;
  likeRatio: number;
  dislikeRatio: number;
  skipRatio: number;
  tmdbVoteAverage: number;
  metadata: {
    title: string;
    overview: string;
    posterPath: string | null;
    releaseDate: string | null;
    voteAverage: number;
  };
}

interface RankedMovieResult {
  tmdbId: number;
  roundIndex: number;
  score: number;
  baseScore: number;
  maxPotentialBaseScore: number;
  decidedCount: number;
  likes: number;
  dislikes: number;
  skips: number;
  scoreBreakdown: RankedScoreBreakdown;
}

interface FinalizeRoomResult {
  finished: boolean;
  status: "active" | "finished";
  winnerTmdbId: number | null;
  reason: string | null;
}

const SCORE_CONFIG = {
  likeWeight: 1,
  dislikeWeight: -0.9,
  skipWeight: -0.15,
  likeRatioWeight: 1.65,
  dislikeRatioWeight: -1.1,
  skipRatioWeight: -0.3,
  tmdbQualityWeight: 0.35,
  certaintyWeight: 0.2,
  consensusBonus: 1.4,
  unanimousBonus: 2.2,
  earlyWinRatio: 0.72,
  topResultsLimit: 5
} as const;

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeVoteAverage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(10, value)) / 10;
}

function toScoreMetadata(snapshot: CandidateMetadataSnapshot | null | undefined) {
  return {
    title: snapshot?.title ?? "Untitled",
    overview: snapshot?.overview ?? "",
    posterPath: snapshot?.poster_path ?? null,
    releaseDate: snapshot?.release_date ?? null,
    voteAverage: Number.isFinite(snapshot?.vote_average) ? Number(snapshot?.vote_average) : 0
  };
}

function evaluateRanking(candidates: CandidateRow[], votes: VoteRow[], memberCount: number) {
  const votesByCandidate = new Map<number, VoteRow[]>();

  for (const vote of votes) {
    const bucket = votesByCandidate.get(vote.tmdb_id);
    if (bucket) {
      bucket.push(vote);
      continue;
    }

    votesByCandidate.set(vote.tmdb_id, [vote]);
  }

  const ranked = candidates.map((candidate) => {
    const candidateVotes = votesByCandidate.get(candidate.tmdb_id) ?? [];
    const decidedUsers = new Set(candidateVotes.map((vote) => vote.user_id));

    let likes = 0;
    let dislikes = 0;
    let skips = 0;

    for (const vote of candidateVotes) {
      if (vote.vote === "like") {
        likes += 1;
        continue;
      }

      if (vote.vote === "dislike") {
        dislikes += 1;
        continue;
      }

      skips += 1;
    }

    const decidedCount = decidedUsers.size;
    const undecidedCount = Math.max(0, memberCount - decidedCount);
    const decisionCoverage = memberCount > 0 ? decidedCount / memberCount : 0;

    const likeRatio = memberCount > 0 ? likes / memberCount : 0;
    const dislikeRatio = memberCount > 0 ? dislikes / memberCount : 0;
    const skipRatio = memberCount > 0 ? skips / memberCount : 0;

    const tmdbVoteAverage = Number.isFinite(candidate.metadata_snapshot?.vote_average)
      ? Number(candidate.metadata_snapshot.vote_average)
      : 0;

    const baseScore =
      likes * SCORE_CONFIG.likeWeight +
      dislikes * SCORE_CONFIG.dislikeWeight +
      skips * SCORE_CONFIG.skipWeight;

    const normalizedTmdbQuality = normalizeVoteAverage(tmdbVoteAverage);

    const consensusBonus = likes >= Math.ceil(memberCount * SCORE_CONFIG.earlyWinRatio) ? SCORE_CONFIG.consensusBonus : 0;
    const unanimousBonus = likes === memberCount && memberCount > 0 ? SCORE_CONFIG.unanimousBonus : 0;

    const score =
      baseScore +
      likeRatio * SCORE_CONFIG.likeRatioWeight +
      dislikeRatio * SCORE_CONFIG.dislikeRatioWeight +
      skipRatio * SCORE_CONFIG.skipRatioWeight +
      normalizedTmdbQuality * SCORE_CONFIG.tmdbQualityWeight +
      decisionCoverage * SCORE_CONFIG.certaintyWeight +
      consensusBonus +
      unanimousBonus;

    const roundedScore = round(score);
    const roundedBaseScore = round(baseScore);

    const scoreBreakdown: RankedScoreBreakdown = {
      rank: 0,
      score: roundedScore,
      baseScore: roundedBaseScore,
      likes,
      dislikes,
      skips,
      decidedCount,
      memberCount,
      decisionCoverage: round(decisionCoverage),
      likeRatio: round(likeRatio),
      dislikeRatio: round(dislikeRatio),
      skipRatio: round(skipRatio),
      tmdbVoteAverage: round(tmdbVoteAverage),
      metadata: toScoreMetadata(candidate.metadata_snapshot)
    };

    return {
      tmdbId: candidate.tmdb_id,
      roundIndex: candidate.round_index,
      score: roundedScore,
      baseScore: roundedBaseScore,
      maxPotentialBaseScore: round(roundedBaseScore + undecidedCount * SCORE_CONFIG.likeWeight),
      decidedCount,
      likes,
      dislikes,
      skips,
      scoreBreakdown
    } satisfies RankedMovieResult;
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.likes !== a.likes) {
      return b.likes - a.likes;
    }

    if (a.dislikes !== b.dislikes) {
      return a.dislikes - b.dislikes;
    }

    return a.roundIndex - b.roundIndex;
  });

  for (let index = 0; index < ranked.length; index += 1) {
    ranked[index].scoreBreakdown.rank = index + 1;
  }

  return ranked;
}

function shouldFinishRoom(ranked: RankedMovieResult[], memberCount: number) {
  if (!ranked.length || memberCount <= 0) {
    return { shouldFinish: false, reason: null as string | null };
  }

  const top = ranked[0];
  const allDecided = ranked.every((candidate) => candidate.decidedCount === memberCount);

  // Single-user sessions are usually exploratory during development and
  // should not terminate after the first decision.
  if (memberCount === 1) {
    if (allDecided) {
      return { shouldFinish: true, reason: "all_candidates_decided" };
    }

    return { shouldFinish: false, reason: null as string | null };
  }

  const unanimousWinner = top.decidedCount === memberCount && top.likes === memberCount;
  if (unanimousWinner) {
    return { shouldFinish: true, reason: "unanimous_consensus" };
  }

  const consensusWinner =
    top.decidedCount === memberCount && top.likes >= Math.ceil(memberCount * SCORE_CONFIG.earlyWinRatio);
  if (consensusWinner) {
    return { shouldFinish: true, reason: "consensus_threshold" };
  }

  const topIsUnbeatable =
    top.decidedCount === memberCount &&
    ranked.slice(1).every((candidate) => top.baseScore > candidate.maxPotentialBaseScore);
  if (topIsUnbeatable) {
    return { shouldFinish: true, reason: "unbeatable_leader" };
  }

  if (allDecided) {
    return { shouldFinish: true, reason: "all_candidates_decided" };
  }

  return { shouldFinish: false, reason: null as string | null };
}

export async function evaluateAndFinalizeRoom(
  supabase: SupabaseClient,
  roomId: string,
  triggeredBy: string
): Promise<FinalizeRoomResult> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,status")
    .eq("id", roomId)
    .single<RoomRow>();

  if (roomError || !room) {
    throw new Error(roomError?.message ?? "Room not found");
  }

  if (room.status === "finished") {
    const { data: existingResults } = await supabase
      .from("room_results")
      .select("tmdb_id,score_breakdown")
      .eq("room_id", roomId);

    const winnerTmdbId =
      existingResults
        ?.find((entry) => Number((entry.score_breakdown as { rank?: number } | null)?.rank) === 1)
        ?.tmdb_id ?? null;

    return {
      finished: true,
      status: "finished",
      winnerTmdbId,
      reason: "already_finished"
    };
  }

  if (room.status !== "active") {
    return {
      finished: false,
      status: "active",
      winnerTmdbId: null,
      reason: null
    };
  }

  const [{ data: members, error: membersError }, { data: candidates, error: candidatesError }, { data: votes, error: votesError }] =
    await Promise.all([
      supabase.from("room_members").select("user_id").eq("room_id", roomId).returns<MemberRow[]>(),
      supabase
        .from("movie_candidates")
        .select("tmdb_id,round_index,metadata_snapshot")
        .eq("room_id", roomId)
        .order("round_index", { ascending: true })
        .returns<CandidateRow[]>(),
      supabase.from("votes").select("tmdb_id,user_id,vote").eq("room_id", roomId).returns<VoteRow[]>()
    ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  if (votesError) {
    throw new Error(votesError.message);
  }

  const memberCount = members?.length ?? 0;
  const ranked = evaluateRanking(candidates ?? [], votes ?? [], memberCount);

  const finishDecision = shouldFinishRoom(ranked, memberCount);
  if (!finishDecision.shouldFinish || !ranked.length) {
    return {
      finished: false,
      status: "active",
      winnerTmdbId: null,
      reason: null
    };
  }

  const decidedAt = new Date().toISOString();
  const resultsToPersist = ranked.slice(0, SCORE_CONFIG.topResultsLimit).map((entry) => ({
    room_id: roomId,
    tmdb_id: entry.tmdbId,
    score_breakdown: entry.scoreBreakdown,
    decided_at: decidedAt
  }));

  const { error: upsertResultsError } = await supabase.from("room_results").upsert(resultsToPersist, {
    onConflict: "room_id,tmdb_id"
  });
  if (upsertResultsError) {
    throw new Error(upsertResultsError.message);
  }

  const { error: finishRoomError } = await supabase
    .from("rooms")
    .update({
      status: "finished",
      ended_at: decidedAt
    })
    .eq("id", roomId)
    .eq("status", "active");

  if (finishRoomError) {
    throw new Error(finishRoomError.message);
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
      type: "room_finished",
      payload: {
        reason: finishDecision.reason,
        winner_tmdb_id: ranked[0].tmdbId,
        triggered_by: triggeredBy,
        ranked_results: resultsToPersist.map((result) => ({
          tmdb_id: result.tmdb_id,
          rank: (result.score_breakdown as RankedScoreBreakdown).rank,
          score: (result.score_breakdown as RankedScoreBreakdown).score
        }))
      },
      seq: nextSeq
    });
  } catch (error) {
    console.warn("room-scoring: event insert failed", error);
  }

  return {
    finished: true,
    status: "finished",
    winnerTmdbId: ranked[0].tmdbId,
    reason: finishDecision.reason
  };
}
