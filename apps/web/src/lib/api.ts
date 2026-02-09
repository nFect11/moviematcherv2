import type { RoomActionResult, RoomCreateInput, RoomJoinInput } from "@moviematcher/shared";
import { ensureAnonymousSession } from "./session";

interface ApiErrorPayload {
  error?: string;
}

async function postFunction<TRequest, TResponse>(endpoint: string, payload: TRequest): Promise<TResponse> {
  const { accessToken } = await ensureAnonymousSession();

  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorPayload = (await response.json()) as ApiErrorPayload;
      if (errorPayload.error) {
        message = errorPayload.error;
      }
    } catch {
      // Fallback to generic status message.
    }
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

export function createRoom(payload: RoomCreateInput) {
  return postFunction<RoomCreateInput, RoomActionResult>("create-room", payload);
}

export function joinRoom(payload: RoomJoinInput) {
  return postFunction<RoomJoinInput, RoomActionResult>("join-room", payload);
}
