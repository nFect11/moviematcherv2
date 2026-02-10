import { HistoryDrawer } from "./HistoryDrawer";
import { MovieInfoModal } from "./MovieInfoModal";
import { RoomMenuDrawer } from "./RoomMenuDrawer";

export function ActiveRoomOverlays() {
  return (
    <>
      <HistoryDrawer />
      <RoomMenuDrawer />
      <MovieInfoModal />
    </>
  );
}
