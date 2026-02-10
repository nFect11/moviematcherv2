import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovieCandidate, VoteChoice } from "@moviematcher/shared";
import { fetchMovieDetails } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import {
  fetchRoomVotingSnapshot,
  submitVote,
  subscribeToVotingChanges,
  toPosterUrl,
} from "../../lib/voting";
import type { ActiveRoomController, SwipeDecision } from "./ActiveRoomContext";
import { ActiveRoomProvider } from "./ActiveRoomProvider";
import { ActiveRoomView } from "./ActiveRoomView";

export function ActiveRoomContainer({
  roomId,
  userId,
  onLeaveRoom,
  onErrorChange,
}: {
  roomId: string;
  userId: string;
  onLeaveRoom: () => void;
  onErrorChange: (message: string | null) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [optimisticDecisions, setOptimisticDecisions] = useState<
    Record<number, SwipeDecision>
  >({});
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cardExit, setCardExit] = useState<{
    tmdbId: number;
    direction: "left" | "right";
    startX: number;
  } | null>(null);

  const queryClient = useQueryClient();
  const swipeExitTimerRef = useRef<number | null>(null);
  const preloadedPosterUrlsRef = useRef<Set<string>>(new Set());

  const votingSnapshotQuery = useQuery({
    queryKey: ["voting", roomId, userId],
    queryFn: () => fetchRoomVotingSnapshot(roomId, userId),
    enabled: Boolean(supabase),
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    return subscribeToVotingChanges(roomId, userId, () => {
      void queryClient.invalidateQueries({
        queryKey: ["voting", roomId, userId],
      });
    });
  }, [roomId, userId, queryClient]);

  const voteMutation = useMutation({
    mutationFn: submitVote,
    onSuccess: () => {
      onErrorChange(null);
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      void queryClient.invalidateQueries({
        queryKey: ["voting", roomId, userId],
      });
    },
    onError: (error: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      onErrorChange(
        error instanceof Error ? error.message : "Could not submit vote",
      );
    },
  });

  const votingSnapshot = votingSnapshotQuery.data;

  const reactionByMovie = useMemo(() => {
    const reactions: Record<number, SwipeDecision> = { ...optimisticDecisions };

    for (const vote of votingSnapshot?.userVotes ?? []) {
      reactions[vote.tmdbId] = vote.vote;
    }

    return reactions;
  }, [optimisticDecisions, votingSnapshot?.userVotes]);

  const historyItems = useMemo(() => {
    if (!votingSnapshot) {
      return [];
    }

    return votingSnapshot.candidates
      .filter((candidate) => Boolean(reactionByMovie[candidate.tmdbId]))
      .map((candidate) => ({
        candidate,
        reaction: reactionByMovie[candidate.tmdbId],
      }));
  }, [reactionByMovie, votingSnapshot]);

  const remainingCandidates = useMemo(
    () =>
      votingSnapshot?.candidates.filter(
        (candidate) => !reactionByMovie[candidate.tmdbId],
      ) ?? [],
    [reactionByMovie, votingSnapshot],
  );

  const currentCandidate = remainingCandidates[0] ?? null;
  const nextCandidate = remainingCandidates[1] ?? null;

  const currentCandidatePoster = toPosterUrl(
    currentCandidate?.posterPath ?? null,
  );
  const nextCandidatePoster = toPosterUrl(nextCandidate?.posterPath ?? null);

  const activeCardExit =
    currentCandidate && cardExit?.tmdbId === currentCandidate.tmdbId
      ? cardExit
      : null;
  const cardIsExiting = Boolean(activeCardExit);
  const dragRevealProgress = cardIsExiting
    ? 1
    : Math.min(1, Math.hypot(dragOffset.x, dragOffset.y) / 110);

  const movieDetailsQuery = useQuery({
    queryKey: ["movie-details", currentCandidate?.tmdbId],
    queryFn: () => fetchMovieDetails({ tmdbId: currentCandidate?.tmdbId ?? 0 }),
    enabled: false,
  });

  useEffect(() => {
    if (!showInfo || !currentCandidate) {
      return;
    }

    void movieDetailsQuery.refetch();
  }, [currentCandidate, movieDetailsQuery, showInfo]);

  useEffect(() => {
    if (!nextCandidatePoster) {
      return;
    }

    if (preloadedPosterUrlsRef.current.has(nextCandidatePoster)) {
      return;
    }

    preloadedPosterUrlsRef.current.add(nextCandidatePoster);
    const image = new Image();
    image.src = nextCandidatePoster;
  }, [nextCandidatePoster]);

  useEffect(() => {
    return () => {
      if (swipeExitTimerRef.current) {
        window.clearTimeout(swipeExitTimerRef.current);
      }
    };
  }, []);

  const commitMovieDecision = (
    candidate: MovieCandidate,
    decision: SwipeDecision,
  ) => {
    if (cardIsExiting) {
      return;
    }

    setOptimisticDecisions((prev) => ({
      ...prev,
      [candidate.tmdbId]: decision,
    }));

    voteMutation.mutate(
      {
        roomId,
        userId,
        tmdbId: candidate.tmdbId,
        vote: decision,
      },
      {
        onError: () => {
          setOptimisticDecisions((prev) => {
            if (!(candidate.tmdbId in prev)) {
              return prev;
            }

            const next = { ...prev };
            delete next[candidate.tmdbId];
            return next;
          });
        },
      },
    );
  };

  const triggerCardSwipe = (decision: VoteChoice, startX = 0) => {
    if (!currentCandidate || cardIsExiting) {
      return;
    }

    if (swipeExitTimerRef.current) {
      window.clearTimeout(swipeExitTimerRef.current);
      swipeExitTimerRef.current = null;
    }

    const direction = decision === "like" ? "right" : "left";
    setCardExit({ tmdbId: currentCandidate.tmdbId, direction, startX });

    swipeExitTimerRef.current = window.setTimeout(() => {
      commitMovieDecision(currentCandidate, decision);
      setCardExit(null);
      swipeExitTimerRef.current = null;
    }, 320);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOffset({ x: 0, y: 0 });

    if (!currentCandidate || cardIsExiting) {
      return;
    }

    if (event.delta.x > 120) {
      triggerCardSwipe("like", event.delta.x);
      return;
    }

    if (event.delta.x < -120) {
      triggerCardSwipe("dislike", event.delta.x);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!currentCandidate || cardIsExiting) {
      return;
    }

    setDragOffset({ x: event.delta.x, y: event.delta.y });
  };

  const handleDragCancel = () => {
    setDragOffset({ x: 0, y: 0 });
  };

  const handleOpenInfo = () => {
    if (!currentCandidate) {
      return;
    }

    setShowInfo(true);
    void movieDetailsQuery.refetch();
  };

  const handleLeaveRoom = () => {
    if (swipeExitTimerRef.current) {
      window.clearTimeout(swipeExitTimerRef.current);
      swipeExitTimerRef.current = null;
    }

    onLeaveRoom();
  };

  const totalCandidates = votingSnapshot?.candidates.length ?? 0;
  const processedCount = Object.keys(reactionByMovie).length;

  const controller: ActiveRoomController = {
    votingLoading: votingSnapshotQuery.isLoading,
    votingErrorMessage:
      votingSnapshotQuery.error instanceof Error
        ? votingSnapshotQuery.error.message
        : null,
    currentCandidate,
    currentCandidatePoster,
    nextCandidate,
    nextCandidatePoster,
    dragRevealProgress,
    processedCount,
    totalCandidates,
    votePending: voteMutation.isPending,
    cardIsExiting,
    activeCardExitDirection: activeCardExit?.direction ?? null,
    activeCardExitStartX: activeCardExit?.startX ?? 0,
    showHistory,
    showMenu,
    showInfo,
    historyItems,
    movieInfoTitle:
      movieDetailsQuery.data?.title ?? currentCandidate?.title ?? "Movie info",
    movieDetailsLoading: movieDetailsQuery.isLoading,
    movieDetailsError:
      movieDetailsQuery.error instanceof Error
        ? movieDetailsQuery.error.message
        : null,
    movieDetailsData: movieDetailsQuery.data,
    onDragEnd: handleDragEnd,
    onDragMove: handleDragMove,
    onDragCancel: handleDragCancel,
    onOpenHistory: () => setShowHistory(true),
    onCloseHistory: () => setShowHistory(false),
    onOpenMenu: () => setShowMenu(true),
    onCloseMenu: () => setShowMenu(false),
    onOpenInfo: handleOpenInfo,
    onCloseInfo: () => setShowInfo(false),
    onLike: () => triggerCardSwipe("like"),
    onDislike: () => triggerCardSwipe("dislike"),
    onSkip: () => {
      if (currentCandidate) {
        commitMovieDecision(currentCandidate, "skip");
      }
    },
    onLeaveRoom: handleLeaveRoom,
  };

  return (
    <ActiveRoomProvider controller={controller}>
      <ActiveRoomView />
    </ActiveRoomProvider>
  );
}
