export type VoteChoice = "like" | "dislike" | "skip";
export type RoomStatus = "lobby" | "active" | "final_voting" | "finished";
export type FinalResolutionMethod = "secret_vote" | "wheel";

export interface RoomCreateInput {
  nickname: string;
  preferredGenres: number[];
  blockedGenres: number[];
  providers: string[];
}

export interface RoomJoinInput {
  roomCode: string;
  nickname: string;
  preferredGenres: number[];
  blockedGenres: number[];
}

export interface RoomActionResult {
  roomId: string;
  roomCode: string;
  userId: string;
  role: "host" | "member";
}

export interface StartRoomInput {
  roomId: string;
}

export interface StartRoomResult {
  roomId: string;
  status: RoomStatus;
  startedAt: string | null;
  candidateCount: number;
}

export interface RoomMember {
  userId: string;
  nickname: string;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoomSnapshot {
  roomId: string;
  roomCode: string;
  status: RoomStatus;
  hostUserId: string;
  startedAt: string | null;
  endedAt: string | null;
  members: RoomMember[];
}

export interface MovieCandidate {
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
  genreIds: number[];
  roundIndex: number;
}

export interface UserVote {
  tmdbId: number;
  vote: VoteChoice;
  decidedAt: string;
}

export interface RoomVotingSnapshotInput {
  roomId: string;
}

export interface RoomVotingAggregate {
  tmdbId: number;
  likes: number;
  dislikes: number;
  skips: number;
  totalDecisions: number;
}

export interface UserPreferenceProfile {
  likedGenres: number[];
  dislikedGenres: number[];
}

export interface RoomVotingSnapshot {
  candidates: MovieCandidate[];
  userVotes: UserVote[];
  aggregates: RoomVotingAggregate[];
  preferenceProfile: UserPreferenceProfile;
}

export interface SubmitDecisionInput {
  roomId: string;
  tmdbId: number;
  vote: VoteChoice;
}

export interface SubmitDecisionResult {
  roomId: string;
  status: RoomStatus;
  finished: boolean;
  winnerTmdbId: number | null;
}

export interface RoomResultScoreBreakdown {
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

export interface RoomResult {
  tmdbId: number;
  decidedAt: string;
  scoreBreakdown: RoomResultScoreBreakdown;
  voters: string[];
  finalVoteCount: number;
}

export interface RoomResultsSnapshot {
  winnerTmdbId: number | null;
  resolutionMethod: FinalResolutionMethod | null;
  tieBreakUsed: boolean;
  results: RoomResult[];
}

export interface FinalVoteSnapshotInput {
  roomId: string;
}

export interface SubmitFinalVoteInput {
  roomId: string;
  tmdbId: number;
}

export interface FinalVoteContender {
  tmdbId: number;
  rank: number;
  scoreBreakdown: RoomResultScoreBreakdown;
}

export interface FinalVoteSnapshot {
  roomId: string;
  status: RoomStatus;
  contenders: FinalVoteContender[];
  totalVoters: number;
  votesSubmitted: number;
  hasVoted: boolean;
  selectedTmdbId: number | null;
  votingComplete: boolean;
  winnerTmdbId: number | null;
  resolutionMethod: FinalResolutionMethod | null;
  tieBreakUsed: boolean;
}

export interface SubmitFinalVoteResult {
  roomId: string;
  status: RoomStatus;
  finished: boolean;
  votesSubmitted: number;
  totalVoters: number;
  winnerTmdbId: number | null;
}

export interface MovieDetailsInput {
  tmdbId: number;
}

export interface MovieTrailer {
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MovieDetails {
  tmdbId: number;
  title: string;
  overview: string;
  releaseDate: string | null;
  runtime: number | null;
  trailers: MovieTrailer[];
}
