/**
 * Resolves the backend base URL for browser fetch calls.
 *
 * In local dev, cross-origin requests to a remote API (e.g. the shared dev
 * environment) are proxied through Next.js rewrites (see next.config.ts) so
 * the browser only talks to localhost and CORS is not involved. Local backend
 * (localhost / 127.0.0.1) is called directly.
 */
export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  if (process.env.NODE_ENV !== "development") {
    return configured;
  }

  try {
    const { hostname, protocol } = new URL(configured);
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocalHost && (protocol === "http:" || protocol === "https:")) {
      return "/api-proxy";
    }
  } catch {
    // Fall through to configured URL if it isn't a valid absolute URL.
  }

  return configured;
}

/** Builds a request URL for the backend, including optional query params. */
export function buildApiUrl(path: string, query?: Record<string, string>): string {
  const base = getApiBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base.replace(/\/$/, "")}${normalizedPath}`;

  if (!query || Object.keys(query).length === 0) {
    return url;
  }

  const params = new URLSearchParams(query);
  return `${url}?${params.toString()}`;
}
