// Tiny typed fetch helper for client components. Centralizes error shape so the
// UI can render friendly messages instead of raw errors.

export interface ApiError {
  code: string;
  message: string;
  extra?: unknown;
}

export class ClientApiError extends Error {
  constructor(public readonly api: ApiError, public readonly status: number) {
    super(api.message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: { "content-type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: { ok?: boolean; data?: T; error?: ApiError } = {};
  try {
    json = await res.json();
  } catch {
    throw new ClientApiError(
      { code: "network_error", message: "We couldn't reach the server. Check your connection." },
      res.status
    );
  }

  if (!res.ok || json.ok === false) {
    throw new ClientApiError(
      json.error || { code: "error", message: "Something went wrong." },
      res.status
    );
  }
  return json.data as T;
}
