export interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}

const baseHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type"
};

export function json(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: baseHeaders,
    body: JSON.stringify(data)
  };
}

export function options() {
  return {
    statusCode: 204,
    headers: baseHeaders,
    body: ""
  };
}

export function readBearerToken(headers: Record<string, string | undefined>) {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice("Bearer ".length).trim();
}

export function parseJsonBody<T>(body: string | null): T | null {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
