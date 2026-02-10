import { createHash, randomUUID } from "node:crypto";
import type { FinalResolutionMethod, SubmitFinalVoteInput, SubmitFinalVoteResult } from "@moviematcher/shared";
import { json, options, parseJsonBody, readBearerToken, type NetlifyEvent } from "./_lib/http";
import { getServiceClient, getUserFromToken } from "./_lib/supabase";

type SubmitFinalVoteBody = SubmitFinalVoteInput;

interface RoomRow {
  id: string;
  status: "lobby" | "active" | "final_voting" | "finished";
}

interface VoteRow {
  user_id: string;
  tmdb_id: number;
}

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickWinnerFromTie(roomId: string, candidates: number[]) {
  const tieBreakSeed = randomUUID();
  const hash = createHash("sha256")
    .update(`${roomId}:${tieBreakSeed}:${candidates.join(",")}`)
    .digest("hex");

  const hashPrefix = hash.slice(0, 8);
  const numeric = Number.parseInt(hashPrefix, 16);
  const index = Number.isNaN(numeric) ? 0 : numeric % candidates.length;

  return {
    winnerTmdbId: candidates[index],
    tieBreakSeed
  };
}

function toVoteCounts(votes: VoteRow[]) {
  const counts = new Map<number, number>();

  for (const vote of votes) {
    counts.set(vote.tmdb_id, (counts.get(vote.tmdb_id) ?? 0) + 1);
  }

  return counts;
}

async function insertRoomEvent({
  roomId,
  type,
  payload
}: {
  roomId: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const supabase = getServiceClient();
  const { data: lastEvent } = await supabase
    .from("room_events")
    .select("seq")
    .eq("room_id", roomId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = (lastEvent?.seq ?? 0) + 1;

  await supabase.from("room_events").insert({
    room_id: roomId,
    type,
    payload,
    seq: nextSeq
  });
}

async function fetchExistingFinalChoice(roomId: string) {
  const supabase = getServiceClient();
  const { data: finalChoice } = await supabase
    .from("room_final_choices")
    .select("tmdb_id,resolution_method,tie_break_used")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!finalChoice) {
    return null;
  }

  return {
    winnerTmdbId: finalChoice.tmdb_id as number,
    resolutionMethod: finalChoice.resolution_method as FinalResolutionMethod,
    tieBreakUsed: Boolean(finalChoice.tie_break_used)
  };
}

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return options();
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const token = readBearerToken(event.headers);
    if (!token) {
      return json(401, { error: "Missing bearer token" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return json(401, { error: "Invalid token" });
    }

    const body = parseJsonBody<SubmitFinalVoteBody>(event.body);
    if (!body) {
      return json(400, { error: "Invalid JSON body" });
    }

    const roomId = body.roomId?.trim();
    if (!roomId || !isLikelyUuid(roomId)) {
      return json(400, { error: "Invalid room ID" });
    }

    if (!Number.isFinite(body.tmdbId)) {
      return json(400, { error: "Invalid TMDB ID" });
    }

    const tmdbId = Math.trunc(body.tmdbId);
    const now = new Date().toISOString();
    const supabase = getServiceClient();

    const [{ data: room, error: roomError }, { data: membership, error: membershipError }, { data: contender, error: contenderError }] =
      await Promise.all([
        supabase.from("rooms").select("id,status").eq("id", roomId).single<RoomRow>(),
        supabase.from("room_members").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle(),
        supabase
          .from("room_final_contenders")
          .select("tmdb_id")
          .eq("room_id", roomId)
          .eq("tmdb_id", tmdbId)
          .maybeSingle()
      ]);

    if (roomError || !room) {
      return json(404, { error: "Room not found" });
    }

    if (membershipError || !membership) {
      return json(403, { error: "You are not a member of this room" });
    }

    if (contenderError || !contender) {
      return json(404, { error: "Movie is not a final contender" });
    }

    if (room.status === "finished") {
      const existingChoice = await fetchExistingFinalChoice(roomId);
      const response: SubmitFinalVoteResult = {
        roomId,
        status: "finished",
        finished: true,
        votesSubmitted: 0,
        totalVoters: 0,
        winnerTmdbId: existingChoice?.winnerTmdbId ?? null
      };

      return json(200, response);
    }

    if (room.status !== "final_voting") {
      return json(409, { error: "Room is not in final voting state" });
    }

    const { error: voteError } = await supabase.from("room_result_votes").upsert(
      {
        room_id: roomId,
        user_id: user.id,
        tmdb_id: tmdbId,
        updated_at: now
      },
      {
        onConflict: "room_id,user_id"
      }
    );

    if (voteError) {
      throw voteError;
    }

    const [{ data: votes, error: votesError }, { data: members, error: membersError }, { data: existingFinalChoice, error: existingFinalChoiceError }] =
      await Promise.all([
        supabase.from("room_result_votes").select("user_id,tmdb_id").eq("room_id", roomId).returns<VoteRow[]>(),
        supabase.from("room_members").select("user_id").eq("room_id", roomId),
        supabase
          .from("room_final_choices")
          .select("tmdb_id,resolution_method,tie_break_used")
          .eq("room_id", roomId)
          .maybeSingle()
      ]);

    if (votesError) {
      throw votesError;
    }

    if (membersError) {
      throw membersError;
    }

    if (existingFinalChoiceError) {
      throw existingFinalChoiceError;
    }

    const totalVoters = members?.length ?? 0;
    const votesSubmitted = votes?.length ?? 0;

    if (existingFinalChoice) {
      const response: SubmitFinalVoteResult = {
        roomId,
        status: "finished",
        finished: true,
        votesSubmitted,
        totalVoters,
        winnerTmdbId: existingFinalChoice.tmdb_id
      };

      return json(200, response);
    }

    if (votesSubmitted < totalVoters || totalVoters === 0) {
      const response: SubmitFinalVoteResult = {
        roomId,
        status: "final_voting",
        finished: false,
        votesSubmitted,
        totalVoters,
        winnerTmdbId: null
      };

      return json(200, response);
    }

    const voteCounts = toVoteCounts(votes ?? []);
    const sortedCounts = [...voteCounts.entries()].sort((left, right) => right[1] - left[1]);

    const topVoteCount = sortedCounts[0]?.[1] ?? 0;
    const tieLeaders = sortedCounts.filter((entry) => entry[1] === topVoteCount).map((entry) => entry[0]);
    const tieBreakUsed = tieLeaders.length > 1;
    const tieResolution = tieBreakUsed
      ? pickWinnerFromTie(roomId, tieLeaders)
      : { winnerTmdbId: tieLeaders[0] ?? tmdbId, tieBreakSeed: null as string | null };

    const voteCountsObject = Object.fromEntries(sortedCounts.map(([movieTmdbId, count]) => [String(movieTmdbId), count]));

    const { error: insertFinalChoiceError } = await supabase.from("room_final_choices").insert({
      room_id: roomId,
      tmdb_id: tieResolution.winnerTmdbId,
      resolution_method: "secret_vote",
      tie_break_used: tieBreakUsed,
      tie_break_candidates: tieLeaders,
      tie_break_seed: tieResolution.tieBreakSeed,
      vote_counts: voteCountsObject,
      resolved_by: user.id,
      resolved_at: now
    });

    if (insertFinalChoiceError) {
      const existingChoice = await fetchExistingFinalChoice(roomId);
      const response: SubmitFinalVoteResult = {
        roomId,
        status: "finished",
        finished: true,
        votesSubmitted,
        totalVoters,
        winnerTmdbId: existingChoice?.winnerTmdbId ?? null
      };

      return json(200, response);
    }

    await supabase
      .from("rooms")
      .update({
        status: "finished",
        ended_at: now
      })
      .eq("id", roomId)
      .eq("status", "final_voting");

    try {
      await insertRoomEvent({
        roomId,
        type: tieBreakUsed ? "final_tie_randomized" : "final_vote_closed",
        payload: {
          winner_tmdb_id: tieResolution.winnerTmdbId,
          tied_tmdb_ids: tieLeaders,
          tie_break_seed: tieResolution.tieBreakSeed,
          vote_counts: voteCountsObject,
          resolved_by: user.id
        }
      });

      await insertRoomEvent({
        roomId,
        type: "final_choice_locked",
        payload: {
          winner_tmdb_id: tieResolution.winnerTmdbId,
          resolution_method: "secret_vote",
          tie_break_used: tieBreakUsed,
          resolved_by: user.id
        }
      });
    } catch (error) {
      console.warn("submit-final-vote: event insert failed", error);
    }

    const response: SubmitFinalVoteResult = {
      roomId,
      status: "finished",
      finished: true,
      votesSubmitted,
      totalVoters,
      winnerTmdbId: tieResolution.winnerTmdbId
    };

    return json(200, response);
  } catch (error) {
    console.error("submit-final-vote error", error);
    return json(500, { error: "Internal server error" });
  }
};
