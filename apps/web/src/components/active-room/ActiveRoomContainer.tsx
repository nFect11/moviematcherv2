import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovieCandidate, VoteChoice } from "@moviematcher/shared";
import { fetchMovieDetails, refetchCandidates } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { fetchRoomVotingSnapshot, submitVote, subscribeToVotingChanges, toPosterUrl } from "../../lib/voting";
import type { ActiveRoomController, SwipeDecision } from "./ActiveRoomContext";
import { ActiveRoomProvider } from "./ActiveRoomProvider";
import { ActiveRoomView } from "./ActiveRoomView";
import { candidateQueueReducer, PRELOAD_QUEUE_SIZE } from "./queue";
import { rankCandidatesForUser } from "./recommendation";

const VOTING_POLL_INTERVAL_MS = 2000;

export function ActiveRoomContainer({
  roomId,
  userId,
  onLeaveRoom,
  onErrorChange
}: {
  roomId: string;
  userId: string;
  onLeaveRoom: () => void;
  onErrorChange: (message: string | null) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [optimisticDecisions, setOptimisticDecisions] = useState<Record<number, SwipeDecision>>({});
  const [candidateQueue, dispatchCandidateQueue] = useReducer(candidateQueueReducer, []);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cardExit, setCardExit] = useState<{ tmdbId: number; direction: "left" | "right"; startX: number } | null>(null);

  const queryClient = useQueryClient();
  const swipeExitTimerRef = useRef<number | null>(null);
  const preloadedPosterUrlsRef = useRef<Set<string>>(new Set());
  const previousLikesByMovieRef = useRef<Map<number, number>>(new Map());
  const exitingCandidateRef = useRef<MovieCandidate | null>(null);
  const decisionCountRef = useRef(0);
  const refetchTimerRef = useRef<number | null>(null);

  const votingSnapshotQuery = useQuery({
    queryKey: ["voting", roomId, userId],
    queryFn: () => fetchRoomVotingSnapshot(roomId),
    refetchInterval: VOTING_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    return subscribeToVotingChanges(roomId, userId, () => {
      void queryClient.invalidateQueries({ queryKey: ["voting", roomId, userId] });
    });
  }, [roomId, userId, queryClient]);

  const voteMutation = useMutation({
    mutationFn: submitVote,
    onSuccess: () => {
      onErrorChange(null);
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      void queryClient.invalidateQueries({ queryKey: ["voting", roomId, userId] });
    },
    onError: (error: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      onErrorChange(error instanceof Error ? error.message : "Could not submit vote");
    }
  });

  const refetchMutation = useMutation({
    mutationFn: () => refetchCandidates({ roomId }),
    onSuccess: (result) => {
      if (result.newTmdbIds.length > 0) {
        dispatchCandidateQueue({
          type: "inject_batch",
          tmdbIds: result.newTmdbIds,
          startIndex: 3
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["voting", roomId, userId] });
    },
    onError: () => {
      // ponytail: silent — refetch failures shouldn't disrupt swiping
    }
  });

  const maybeRefetch = () => {
    decisionCountRef.current += 1;
    if (decisionCountRef.current % 5 === 0) {
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
      }

      refetchTimerRef.current = window.setTimeout(() => {
        refetchMutation.mutate();
        refetchTimerRef.current = null;
      }, 400);
    }
  };

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
        reaction: reactionByMovie[candidate.tmdbId]
      }));
  }, [reactionByMovie, votingSnapshot]);

  const rankedRemainingCandidates = useMemo(() => {
    if (!votingSnapshot) {
      return [];
    }

    return rankCandidatesForUser({
      candidates: votingSnapshot.candidates,
      reactionByMovie,
      aggregates: votingSnapshot.aggregates,
      preferenceProfile: votingSnapshot.preferenceProfile
    });
  }, [reactionByMovie, votingSnapshot]);

  const rankedRemainingCandidateIds = useMemo(
    () => rankedRemainingCandidates.map((candidate) => candidate.tmdbId),
    [rankedRemainingCandidates]
  );

  const candidateByMovieId = useMemo(() => {
    return new Map((votingSnapshot?.candidates ?? []).map((candidate) => [candidate.tmdbId, candidate]));
  }, [votingSnapshot?.candidates]);

  useEffect(() => {
    if (!votingSnapshot) {
      dispatchCandidateQueue({ type: "reset" });
      previousLikesByMovieRef.current = new Map();
      return;
    }

    dispatchCandidateQueue({
      type: "reconcile",
      rankedCandidateIds: rankedRemainingCandidateIds
    });
  }, [rankedRemainingCandidateIds, votingSnapshot]);

  useEffect(() => {
    if (!votingSnapshot) {
      return;
    }

    const likeCountsByMovie = new Map(votingSnapshot.aggregates.map((aggregate) => [aggregate.tmdbId, aggregate.likes]));
    const rankedCandidateIdSet = new Set(rankedRemainingCandidateIds);
    const likedCandidateIds: number[] = [];

    for (const aggregate of votingSnapshot.aggregates) {
      const previousLikes = previousLikesByMovieRef.current.get(aggregate.tmdbId);
      const gainedLikes = previousLikes !== undefined && aggregate.likes > previousLikes;
      if (!gainedLikes) {
        continue;
      }

      if (reactionByMovie[aggregate.tmdbId]) {
        continue;
      }

      if (!rankedCandidateIdSet.has(aggregate.tmdbId)) {
        continue;
      }

      likedCandidateIds.push(aggregate.tmdbId);
    }

    previousLikesByMovieRef.current = likeCountsByMovie;

    if (!likedCandidateIds.length) {
      return;
    }

    dispatchCandidateQueue({
      type: "inject_likes",
      likedCandidateIds,
      likeCountsByMovie
    });
  }, [rankedRemainingCandidateIds, reactionByMovie, votingSnapshot]);

  // Cross-user social injection: every ~8 swipes, inject a highly-liked movie
  // from the room's liked pool, even if genres don't match this user's preferences.
  const processedCount = Object.keys(reactionByMovie).length;
  const crossInjectionTriggeredRef = useRef(new Set<number>());

  useEffect(() => {
    if (!votingSnapshot || processedCount === 0) {
      return;
    }

    // Trigger on swipes 8, 16, 24, 32, 40
    if (processedCount % 8 !== 0) {
      return;
    }

    // Don't trigger twice for the same count
    if (crossInjectionTriggeredRef.current.has(processedCount)) {
      return;
    }

    crossInjectionTriggeredRef.current.add(processedCount);

    // Find liked-pool movies: any movie with likes >= 1 where this user hasn't voted
    const pool = votingSnapshot.aggregates
      .filter((a) => a.likes > 0 && !reactionByMovie[a.tmdbId])
      .filter((a) => rankedRemainingCandidateIds.includes(a.tmdbId))
      .sort((a, b) => b.likes - a.likes);

    if (pool.length === 0) {
      return;
    }

    // Deterministic "random" pick: hash of processedCount + userId
    const hashInput = `${processedCount}:${userId}`;
    let hashAcc = 0;
    for (let i = 0; i < hashInput.length; i += 1) {
      hashAcc = ((hashAcc << 5) - hashAcc + hashInput.charCodeAt(i)) | 0;
    }

    const pickIndex = Math.abs(hashAcc) % pool.length;
    const picked = pool[pickIndex];

    dispatchCandidateQueue({
      type: "inject_batch",
      tmdbIds: [picked.tmdbId],
      startIndex: 3
    });
  }, [processedCount, votingSnapshot, reactionByMovie, rankedRemainingCandidateIds, userId]);

  const queuedCandidates = useMemo(
    () =>
      candidateQueue
        .map((tmdbId) => candidateByMovieId.get(tmdbId) ?? null)
        .filter((candidate): candidate is MovieCandidate => Boolean(candidate)),
    [candidateByMovieId, candidateQueue]
  );

  const currentCandidate = queuedCandidates[0] ?? null;
  const nextCandidate = queuedCandidates[1] ?? null;

  const currentCandidatePoster = toPosterUrl(currentCandidate?.posterPath ?? null);
  const nextCandidatePoster = toPosterUrl(nextCandidate?.posterPath ?? null);
  const preloadedQueuePosterUrls = useMemo(
    () =>
      queuedCandidates
        .slice(1, PRELOAD_QUEUE_SIZE + 1)
        .map((candidate) => toPosterUrl(candidate.posterPath))
        .filter((posterUrl): posterUrl is string => Boolean(posterUrl)),
    [queuedCandidates]
  );

  const cardIsExiting = Boolean(cardExit);
  const dragRevealProgress = cardIsExiting ? 1 : Math.min(1, Math.hypot(dragOffset.x, dragOffset.y) / 110);

  // During exit, nextCandidate is the 2nd-next movie (queue shifted).
  // Show currentCandidate underneath instead — it's the card transitioning in.
  const displayedNextCandidate = cardIsExiting ? currentCandidate : nextCandidate;
  const displayedNextPoster = cardIsExiting ? currentCandidatePoster : nextCandidatePoster;

  const movieDetailsQuery = useQuery({
    queryKey: ["movie-details", currentCandidate?.tmdbId],
    queryFn: () => fetchMovieDetails({ tmdbId: currentCandidate?.tmdbId ?? 0 }),
    enabled: false
  });

  useEffect(() => {
    if (!showInfo || !currentCandidate) {
      return;
    }

    void movieDetailsQuery.refetch();
  }, [currentCandidate, movieDetailsQuery, showInfo]);

  useEffect(() => {
    for (const posterUrl of preloadedQueuePosterUrls) {
      if (preloadedPosterUrlsRef.current.has(posterUrl)) {
        continue;
      }

      preloadedPosterUrlsRef.current.add(posterUrl);
      const image = new Image();
      image.src = posterUrl;
    }
  }, [preloadedQueuePosterUrls]);

  useEffect(() => {
    return () => {
      if (swipeExitTimerRef.current) {
        window.clearTimeout(swipeExitTimerRef.current);
      }
    };
  }, []);

  const commitMovieDecision = (candidate: MovieCandidate, decision: SwipeDecision) => {
    if (cardIsExiting) {
      return;
    }

    dispatchCandidateQueue({ type: "remove", tmdbId: candidate.tmdbId });
    setOptimisticDecisions((prev) => ({ ...prev, [candidate.tmdbId]: decision }));
    maybeRefetch();

    voteMutation.mutate(
      {
        roomId,
        userId,
        tmdbId: candidate.tmdbId,
        vote: decision
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
          dispatchCandidateQueue({ type: "prepend", tmdbId: candidate.tmdbId });
        }
      }
    );
  };

  const finalizeCardExit = (candidate: MovieCandidate, decision: VoteChoice) => {
    maybeRefetch();
    voteMutation.mutate(
      {
        roomId,
        userId,
        tmdbId: candidate.tmdbId,
        vote: decision
      },
      {
        onError: () => {
          setOptimisticDecisions((prev) => {
            const next = { ...prev };
            delete next[candidate.tmdbId];
            return next;
          });
          dispatchCandidateQueue({ type: "prepend", tmdbId: candidate.tmdbId });
        }
      }
    );
    setCardExit(null);
    exitingCandidateRef.current = null;
    swipeExitTimerRef.current = null;
  };

  const triggerCardSwipe = (decision: VoteChoice, startX = 0) => {
    if (!currentCandidate || cardIsExiting) {
      return;
    }

    if (swipeExitTimerRef.current) {
      window.clearTimeout(swipeExitTimerRef.current);
      swipeExitTimerRef.current = null;
    }

    const candidate = currentCandidate;

    // Pin the exiting candidate so SwipeMovieCard can keep rendering it during exit
    exitingCandidateRef.current = candidate;

    // Remove from queue IMMEDIATELY — lets next card pre-render during exit animation
    dispatchCandidateQueue({ type: "remove", tmdbId: candidate.tmdbId });
    setOptimisticDecisions((prev) => ({ ...prev, [candidate.tmdbId]: decision }));
    setDragOffset({ x: 0, y: 0 });

    const direction = decision === "like" ? "right" : "left";
    setCardExit({ tmdbId: candidate.tmdbId, direction, startX });

    swipeExitTimerRef.current = window.setTimeout(() => {
      finalizeCardExit(candidate, decision);
    }, 80);
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

  const controller: ActiveRoomController = {
    votingLoading: votingSnapshotQuery.isLoading,
    votingErrorMessage: votingSnapshotQuery.error instanceof Error ? votingSnapshotQuery.error.message : null,
    currentCandidate,
    currentCandidatePoster,
    nextCandidate: displayedNextCandidate,
    nextCandidatePoster: displayedNextPoster,
    exitingCandidate: exitingCandidateRef.current,
    displayedTmdbId: exitingCandidateRef.current?.tmdbId ?? currentCandidate?.tmdbId ?? null,
    dragRevealProgress,
    processedCount,
    totalCandidates,
    votePending: voteMutation.isPending,
    cardIsExiting,
    activeCardExitDirection: cardExit?.direction ?? null,
    activeCardExitStartX: cardExit?.startX ?? 0,
    showHistory,
    showMenu,
    showInfo,
    historyItems,
    movieInfoTitle: movieDetailsQuery.data?.title ?? currentCandidate?.title ?? "Movie info",
    movieDetailsLoading: movieDetailsQuery.isLoading,
    movieDetailsError: movieDetailsQuery.error instanceof Error ? movieDetailsQuery.error.message : null,
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
    onLeaveRoom: handleLeaveRoom
  };

  return (
    <ActiveRoomProvider controller={controller}>
      <ActiveRoomView />
    </ActiveRoomProvider>
  );
}

export default ActiveRoomContainer;
