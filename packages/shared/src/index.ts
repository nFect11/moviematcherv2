export type VoteChoice = "like" | "dislike";

export interface RoomCreateInput {
  nickname: string;
  preferredGenres: number[];
  blockedGenres: number[];
  providers: string[];
}
