/**
 * Client for the SafeIQ Internal console (backend `/internal/*`, backed by
 * `control.internal_users`). Kept separate from lib/apiClient.ts: internal
 * accounts are cross-tenant and their token carries `scope: "internal"`,
 * which the tenant API rejects and vice-versa. Its session token lives
 * under its own sessionStorage keys so the two never collide.
 *
 * Milestone 3: internal users own the onboarding video catalogue (tasks
 * 21-22). Tenant users only consume it (tasks 23-26, via lib/apiClient.ts).
 */

import { ApiError } from "./apiClient";
import type { ApiVideoAudience } from "./apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "safeiq-internal-access-token";
const REFRESH_TOKEN_KEY = "safeiq-internal-refresh-token";

function hasWindow() {
  return typeof window !== "undefined";
}

export function getInternalToken(): string | null {
  return hasWindow() ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function setInternalSession(accessToken: string, refreshToken: string) {
  if (!hasWindow()) return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearInternalSession() {
  if (!hasWindow()) return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasInternalSession(): boolean {
  return getInternalToken() !== null;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getInternalToken();
    if (!token) throw new ApiError(401, "Not signed in to SafeIQ Internal");
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, API_BASE).toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Could not reach the SafeIQ API at ${API_BASE}`);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data ? String((data as { detail: unknown }).detail) : response.statusText;
    throw new ApiError(response.status, detail);
  }
  return data as T;
}

export interface InternalUser {
  id: string;
  name: string;
  email: string;
}

export interface InternalVideo {
  id: string;
  title: string;
  description: string;
  thumbnail_gradient: string;
  media_url: string | null;
  category: string | null;
  audience: ApiVideoAudience;
  order_index: number;
  duration_seconds: number;
  created_by: string;
  created_at: string;
}

export interface MediaUpload {
  upload_url: string;
  media_key: string;
  headers: Record<string, string>;
}

export interface CreateVideoInput {
  title: string;
  description: string;
  thumbnail_gradient: string;
  audience: ApiVideoAudience;
  duration_seconds: number;
  media_url?: string | null;
  media_key?: string | null;
  category?: string | null;
}

export const internalApiClient = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>("/internal/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  me: () => request<InternalUser>("/internal/me", { auth: true }),

  listVideos: () => request<InternalVideo[]>("/internal/onboarding/videos", { auth: true }),

  createVideo: (payload: CreateVideoInput) =>
    request<InternalVideo>("/internal/onboarding/videos", { method: "POST", body: payload, auth: true }),

  updateVideo: (id: string, payload: Partial<CreateVideoInput>) =>
    request<InternalVideo>(`/internal/onboarding/videos/${id}`, { method: "PATCH", body: payload, auth: true }),

  deleteVideo: (id: string) => request<void>(`/internal/onboarding/videos/${id}`, { method: "DELETE", auth: true }),

  reorderVideos: (orderedIds: string[]) =>
    request<InternalVideo[]>("/internal/onboarding/videos/reorder", {
      method: "POST",
      body: { ordered_video_ids: orderedIds },
      auth: true,
    }),

  createUploadUrl: (filename: string, contentType: string) =>
    request<MediaUpload>("/internal/onboarding/videos/upload-url", {
      method: "POST",
      body: { filename, content_type: contentType },
      auth: true,
    }),
};

/** PUT a file straight to the presigned URL (S3), bypassing the API. */
export async function putToPresignedUrl(url: string, headers: Record<string, string>, file: File): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { method: "PUT", headers, body: file });
  } catch {
    throw new ApiError(0, "Could not reach the upload endpoint");
  }
  if (!response.ok) throw new ApiError(response.status, `Upload failed (${response.status})`);
}
