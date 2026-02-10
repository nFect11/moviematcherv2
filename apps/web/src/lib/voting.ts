import type { RoomVotingSnapshot, VoteChoice } from "@moviematcher/shared";
import { fetchVotingSnapshot, submitDecision } from "./api";
import { supabase } from "./supabase";

export async function fetchRoomVotingSnapshot(roomId: string): Promise<RoomVotingSnapshot> {
  return fetchVotingSnapshot({ roomId });
}

export async function submitVote(payload: { roomId: string; userId: string; tmdbId: number; vote: VoteChoice }) {
  await submitDecision({
    roomId: payload.roomId,
    tmdbId: payload.tmdbId,
    vote: payload.vote
  });
}

export function subscribeToVotingChanges(roomId: string, userId: string, onChange: () => void): () => void {
  const client = supabase;
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel(`voting-sync:${roomId}:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "movie_candidates", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function toPosterUrl(path: string | null) {
  if (!path) {
    return null;
  }

  return `https://image.tmdb.org/t/p/w500${path}`;
}
