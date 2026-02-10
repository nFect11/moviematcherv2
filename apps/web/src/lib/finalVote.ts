import type { FinalVoteSnapshot } from "@moviematcher/shared";
import { fetchFinalVoteSnapshot, submitFinalVote } from "./api";
import { supabase } from "./supabase";

export async function fetchRoomFinalVoteSnapshot(roomId: string): Promise<FinalVoteSnapshot> {
  return fetchFinalVoteSnapshot({ roomId });
}

export async function submitRoomFinalVote(payload: { roomId: string; tmdbId: number }) {
  return submitFinalVote({
    roomId: payload.roomId,
    tmdbId: payload.tmdbId
  });
}

export function subscribeToFinalVotingChanges(roomId: string, userId: string, onChange: () => void): () => void {
  const client = supabase;
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel(`final-vote-sync:${roomId}:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_final_contenders", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_result_votes", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_final_choices", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
