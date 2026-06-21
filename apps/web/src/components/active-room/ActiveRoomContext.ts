import { createContext, useContext } from "react";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import type { MovieCandidate, MovieDetails, VoteChoice } from "@moviematcher/shared";

export type SwipeDecision = VoteChoice | "skip";

export type HistoryItem = {
  candidate: MovieCandidate;
  reaction: SwipeDecision;
};

export type ActiveRoomController = {
  votingLoading: boolean;
  votingErrorMessage: string | null;
  currentCandidate: MovieCandidate | null;
  currentCandidatePoster: string | null;
  nextCandidate: MovieCandidate | null;
  nextCandidatePoster: string | null;
  exitingCandidate: MovieCandidate | null;
  displayedTmdbId: number | null;
  dragRevealProgress: number;
  processedCount: number;
  totalCandidates: number;
  votePending: boolean;
  cardIsExiting: boolean;
  activeCardExitDirection: "left" | "right" | null;
  activeCardExitStartX: number;
  showHistory: boolean;
  showMenu: boolean;
  showInfo: boolean;
  historyItems: HistoryItem[];
  movieInfoTitle: string;
  movieDetailsLoading: boolean;
  movieDetailsError: string | null;
  movieDetailsData: MovieDetails | undefined;
  onDragEnd: (event: DragEndEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragCancel: () => void;
  onOpenHistory: () => void;
  onCloseHistory: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
  onLike: () => void;
  onDislike: () => void;
  onSkip: () => void;
  onLeaveRoom: () => void;
};

export const activeRoomContext = createContext<ActiveRoomController | null>(null);

export function useActiveRoomController() {
  const context = useContext(activeRoomContext);
  if (!context) {
    throw new Error("useActiveRoomController must be used within ActiveRoomProvider");
  }

  return context;
}
