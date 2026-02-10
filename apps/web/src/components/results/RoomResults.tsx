import { useQuery } from "@tanstack/react-query";
import { fetchRoomResults } from "../../lib/results";
import { ResultsView, type ResultsViewModel } from "./ResultsView";

export function RoomResults({
  roomId,
  roomCode,
  onLeaveRoom
}: {
  roomId: string;
  roomCode: string | null;
  onLeaveRoom: () => void;
}) {
  const resultsQuery = useQuery({
    queryKey: ["room-results", roomId],
    queryFn: () => fetchRoomResults(roomId)
  });

  const model: ResultsViewModel = {
    roomCode,
    isLoading: resultsQuery.isLoading,
    errorMessage: resultsQuery.error instanceof Error ? resultsQuery.error.message : null,
    snapshot: resultsQuery.data ?? null,
    onLeaveRoom
  };

  return <ResultsView model={model} />;
}

export default RoomResults;
