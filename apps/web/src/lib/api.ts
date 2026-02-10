import type {
  FinalVoteSnapshot,
  FinalVoteSnapshotInput,
  MovieDetails,
  MovieDetailsInput,
  RoomVotingSnapshot,
  RoomVotingSnapshotInput,
  SubmitDecisionInput,
  SubmitFinalVoteInput,
  SubmitFinalVoteResult,
  SubmitDecisionResult,
  RoomActionResult,
  RoomCreateInput,
  RoomJoinInput,
  StartRoomInput,
  StartRoomResult
} from "@moviematcher/shared";
import { ensureAnonymousSession } from "./session";

interface ApiErrorPayload {
  error?: string;
}

async function postFunction<TRequest, TResponse>(endpoint: string, payload: TRequest): Promise<TResponse> {
  const { accessToken } = await ensureAnonymousSession();

  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorPayload = (await response.json()) as ApiErrorPayload;
      if (errorPayload.error) {
        message = errorPayload.error;
      }
    } catch {
      // Fallback to generic status message.
    }
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

export function createRoom(payload: RoomCreateInput) {
  return postFunction<RoomCreateInput, RoomActionResult>("create-room", payload);
}

export function joinRoom(payload: RoomJoinInput) {
  return postFunction<RoomJoinInput, RoomActionResult>("join-room", payload);
}

export function startRoom(payload: StartRoomInput) {
  return postFunction<StartRoomInput, StartRoomResult>("start-room", payload);
}

export function fetchMovieDetails(payload: MovieDetailsInput) {
  return postFunction<MovieDetailsInput, MovieDetails>("movie-details", payload);
}

export function submitDecision(payload: SubmitDecisionInput) {
  return postFunction<SubmitDecisionInput, SubmitDecisionResult>("submit-decision", payload);
}

export function fetchVotingSnapshot(payload: RoomVotingSnapshotInput) {
  return postFunction<RoomVotingSnapshotInput, RoomVotingSnapshot>("voting-snapshot", payload);
}

export function fetchFinalVoteSnapshot(payload: FinalVoteSnapshotInput) {
  return postFunction<FinalVoteSnapshotInput, FinalVoteSnapshot>("final-vote-snapshot", payload);
}

export function submitFinalVote(payload: SubmitFinalVoteInput) {
  return postFunction<SubmitFinalVoteInput, SubmitFinalVoteResult>("submit-final-vote", payload);
}
