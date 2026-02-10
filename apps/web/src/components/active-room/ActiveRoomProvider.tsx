import type { ReactNode } from "react";
import {
  activeRoomContext,
  type ActiveRoomController,
} from "./ActiveRoomContext";

export function ActiveRoomProvider({
  controller,
  children,
}: {
  controller: ActiveRoomController;
  children: ReactNode;
}) {
  return (
    <activeRoomContext.Provider value={controller}>
      {children}
    </activeRoomContext.Provider>
  );
}
