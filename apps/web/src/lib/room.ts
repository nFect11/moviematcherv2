import type { RoomMember, RoomSnapshot, RoomStatus } from "@moviematcher/shared";
import { supabase } from "./supabase";

interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  host_user_id: string;
  started_at: string | null;
  ended_at: string | null;
}

interface RoomMemberRow {
  user_id: string;
  nickname: string;
  connected: boolean;
  joined_at: string;
  last_seen_at: string;
}

export async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const [{ data: room, error: roomError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("rooms").select("id,code,status,host_user_id,started_at,ended_at").eq("id", roomId).single<RoomRow>(),
    supabase
      .from("room_members")
      .select("user_id,nickname,connected,joined_at,last_seen_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })
      .returns<RoomMemberRow[]>()
  ]);

  if (roomError || !room) {
    throw new Error(roomError?.message ?? "Could not load room state");
  }

  if (membersError) {
    throw new Error(membersError.message);
  }

  const mappedMembers: RoomMember[] = (members ?? []).map((member) => ({
    userId: member.user_id,
    nickname: member.nickname,
    connected: member.connected,
    joinedAt: member.joined_at,
    lastSeenAt: member.last_seen_at
  }));

  return {
    roomId: room.id,
    roomCode: room.code,
    status: room.status,
    hostUserId: room.host_user_id,
    startedAt: room.started_at,
    endedAt: room.ended_at,
    members: mappedMembers
  };
}

export function subscribeToRoomChanges(roomId: string, onChange: () => void): () => void {
  const client = supabase;
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel(`room-sync:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
