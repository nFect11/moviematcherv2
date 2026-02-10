import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRoomFinalVoteSnapshot, submitRoomFinalVote, subscribeToFinalVotingChanges } from "../../lib/finalVote";
import { supabase } from "../../lib/supabase";
import { FinalVotingView } from "./FinalVotingView";

const FINAL_VOTE_POLL_INTERVAL_MS = 2000;

export function FinalVotingContainer({
  roomId,
  roomCode,
  userId,
  onLeaveRoom,
  onErrorChange
}: {
  roomId: string;
  roomCode: string | null;
  userId: string;
  onLeaveRoom: () => void;
  onErrorChange: (message: string | null) => void;
}) {
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const finalVoteQuery = useQuery({
    queryKey: ["final-vote", roomId, userId],
    queryFn: () => fetchRoomFinalVoteSnapshot(roomId),
    refetchInterval: FINAL_VOTE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    return subscribeToFinalVotingChanges(roomId, userId, () => {
      void queryClient.invalidateQueries({ queryKey: ["final-vote", roomId, userId] });
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    });
  }, [queryClient, roomId, userId]);

  const submitVoteMutation = useMutation({
    mutationFn: submitRoomFinalVote,
    onSuccess: () => {
      onErrorChange(null);
      void queryClient.invalidateQueries({ queryKey: ["final-vote", roomId, userId] });
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
    onError: (error: unknown) => {
      onErrorChange(error instanceof Error ? error.message : "Could not submit final vote");
      void queryClient.invalidateQueries({ queryKey: ["final-vote", roomId, userId] });
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    }
  });

  const snapshot = finalVoteQuery.data ?? null;
  const effectiveSelectedTmdbId = snapshot?.selectedTmdbId ?? selectedTmdbId;

  const handleSubmitVote = () => {
    if (effectiveSelectedTmdbId === null || snapshot?.hasVoted) {
      return;
    }

    submitVoteMutation.mutate({
      roomId,
      tmdbId: effectiveSelectedTmdbId
    });
  };

  return (
    <FinalVotingView
      roomCode={roomCode}
      snapshot={snapshot}
      isLoading={finalVoteQuery.isLoading}
      errorMessage={finalVoteQuery.error instanceof Error ? finalVoteQuery.error.message : null}
      submitPending={submitVoteMutation.isPending}
      selectedTmdbId={effectiveSelectedTmdbId}
      onSelect={setSelectedTmdbId}
      onSubmitVote={handleSubmitVote}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

export default FinalVotingContainer;
