export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, service: "moviematcher-functions" }), {
    headers: { "content-type": "application/json" }
  });
}
