export type VoteChoice = "like" | "dislike";

export interface RoomCreateInput {
  nickname: string;
  preferredGenres: number[];
  blockedGenres: number[];
  providers: string[];
}

export interface RoomJoinInput {
  roomCode: string;
  nickname: string;
  preferredGenres: number[];
  blockedGenres: number[];
}

export interface RoomActionResult {
  roomId: string;
  roomCode: string;
  userId: string;
  role: "host" | "member";
}
