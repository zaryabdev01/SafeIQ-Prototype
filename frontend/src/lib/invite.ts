const INVITE_PATH_RE = /\/(?:invite|join)\/([^/?#]+)\/?$/i;

/**
 * Read an invite token from a pathname (e.g. /invite/mg-abc or /join/mg-abc).
 */
export function parseInviteTokenFromPathname(pathname: string): string | null {
  const match = pathname.match(INVITE_PATH_RE);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Parse an invite link or bare token from user input.
 * Production magic links use /join/{token}; the accept screen also lives at /invite/{token}.
 */
export function extractInviteToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Full URL or path containing /invite/ or /join/
  const fromPath = trimmed.match(/\/(?:invite|join)\/([^/?#]+)/i);
  if (fromPath) {
    try {
      return decodeURIComponent(fromPath[1]);
    } catch {
      return null;
    }
  }

  // Reject other absolute URLs (dashboard links, etc.)
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://") || /^https?%3A/i.test(trimmed)) {
    return null;
  }

  const bare = trimmed.replace(/^\/+|\/+$/g, "");
  if (!bare || bare.includes("/") || bare.includes("?") || bare.includes("#")) {
    return null;
  }

  return bare;
}

/** Canonical in-app route used after parsing user input. */
export function inviteAcceptPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

/** Public magic-link path segment (matches mock data + production emails). */
export function inviteJoinPath(token: string): string {
  return `/join/${encodeURIComponent(token)}`;
}
