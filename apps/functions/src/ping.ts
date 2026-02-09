import { json, options, type NetlifyEvent } from "./_lib/http";

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return options();
  }

  return json(200, { ok: true, service: "moviematcher-functions" });
};
