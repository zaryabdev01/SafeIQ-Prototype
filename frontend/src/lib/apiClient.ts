/**
 * Client for the real backend (../../backend). This is a deliberately separate,
 * additive integration path - see backend/README.md and the root README.md for
 * why the rest of the app (RAGs, alerts, chat, etc.) still runs on the mock
 * store in lib/store.tsx: the backend only implements Milestone 2
 * (Authentication & Multi-Tenant Foundation) and Milestone 3 (Onboarding CMS)
 * so far.
 *
 * Session tokens live in sessionStorage under their own keys, distinct from
 * the mock store's `safeiq-session-user-id`, so the two systems never collide.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "safeiq-api-access-token";
const REFRESH_TOKEN_KEY = "safeiq-api-refresh-token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function hasWindow() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  return hasWindow() ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function setApiSession(accessToken: string, refreshToken: string) {
  if (!hasWindow()) return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearApiSession() {
  if (!hasWindow()) return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasApiSession(): boolean {
  return getAccessToken() !== null;
}

/**
 * Reads the org_id claim out of an access token without verifying its
 * signature - fine for UI convenience (deciding which mock-store org to
 * bridge into, see lib/apiMapping.ts) since it's never used for an
 * authorization decision; the backend independently verifies the token's
 * signature on every real request.
 */
export function decodeAccessTokenClaims(token: string): { sub: string; org_id: string; tenant_schema: string; role: string } | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean; query?: Record<string, string> } = {}): Promise<T> {
  const { method = "GET", body, auth = false, query } = options;

  const url = new URL(path, API_BASE);
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (!token) throw new ApiError(401, "Not signed in");
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Could not reach the SafeIQ API at ${API_BASE} - is the backend running? (docker compose up, in backend/)`);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? String((data as { detail: unknown }).detail) : response.statusText;
    throw new ApiError(response.status, detail);
  }
  return data as T;
}

// ---- Types mirroring backend/app/schemas/*.py ----

export type ApiTeamRole = "super_admin" | "administrator" | "manager" | "support" | "employee";

export interface SignupResponse {
  user_id: string;
  org_id: string;
  onboarding_token: string;
  requires_email_verification: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface OrganisationLookup {
  organisation_id: string;
  organisation_name: string;
}

export interface ApiUserProfile {
  id: string;
  name: string;
  email: string;
  team_role: ApiTeamRole;
  job_title: string | null;
  country: string | null;
  language: string | null;
  email_verified: boolean;
  kyc_status: string;
}

export interface ApiInvite {
  id: string;
  token: string;
  link: string;
  email: string | null;
  role: ApiTeamRole;
  status: string;
  expires_at: string;
}

export interface ApiInvitePreview {
  organisation_name: string;
  role: ApiTeamRole;
  email: string | null;
  status: string;
}

export interface ApiAuditEntry {
  id: number;
  event_type: string;
  subject_id: string;
  owner_id: string | null;
  content_hash: string;
  prev_hash: string;
  entry_hash: string;
  created_at: string;
}

export interface ApiAuditVerification {
  valid: boolean;
  entries_checked: number;
}

export type ApiVideoAudience = "organisation" | "employee" | "all";

export interface ApiOnboardingVideo {
  id: string;
  title: string;
  description: string;
  thumbnail_gradient: string;
  media_url: string | null;
  audience: ApiVideoAudience;
  order_index: number;
  duration_seconds: number;
  created_by: string;
  created_at: string;
}

export interface ApiVideoAnalytics {
  video_id: string;
  title: string;
  view_count: number;
  share_count: number;
}

export interface ApiOnboardingAnalytics {
  videos: ApiVideoAnalytics[];
  top_search_queries: string[];
  total_searches: number;
  total_views: number;
  total_shares: number;
}

export const apiClient = {
  baseUrl: API_BASE,

  signupOrganisation: (payload: { organisation_name: string; sector?: string; full_name: string; email: string; password: string }) =>
    request<SignupResponse>("/auth/signup/organisation", { method: "POST", body: payload }),

  signupEmployee: (payload: { full_name: string; email: string; password: string; organisation_id: string }) =>
    request<SignupResponse>("/auth/signup/employee", { method: "POST", body: payload }),

  lookupOrganisations: (email: string) => request<OrganisationLookup[]>("/auth/organisations", { query: { email } }),

  verifyOtp: (payload: { onboarding_token: string; code: string }) =>
    request<{ verified: boolean; next_step: "kyc" }>("/auth/verify-otp", { method: "POST", body: payload }),

  startKyc: (onboardingToken: string) =>
    request<{ provider: string; session_id: string; status: string; redirect_url: string | null }>("/auth/kyc/start", {
      method: "POST",
      query: { onboarding_token: onboardingToken },
    }),

  kycStatus: (onboardingToken: string) => request<{ status: string }>("/auth/kyc/status", { query: { onboarding_token: onboardingToken } }),

  login: (payload: { email: string; password: string; organisation_id: string }) => request<TokenResponse>("/auth/login", { method: "POST", body: payload }),

  me: () => request<ApiUserProfile>("/me", { auth: true }),

  updateSettings: (payload: { country?: string; language?: string; job_title?: string }) =>
    request<ApiUserProfile>("/me/settings", { method: "PATCH", body: payload, auth: true }),

  listTeam: () => request<ApiUserProfile[]>("/team", { auth: true }),

  updateRole: (userId: string, role: ApiTeamRole) => request<ApiUserProfile>(`/team/${userId}/role`, { method: "PATCH", body: { role }, auth: true }),

  createInvite: (payload: { email?: string; role: ApiTeamRole }) => request<ApiInvite>("/invites", { method: "POST", body: payload, auth: true }),

  listInvites: () => request<ApiInvite[]>("/invites", { auth: true }),

  resendInvite: (token: string) => request<ApiInvite>(`/invites/${token}/resend`, { method: "POST", auth: true }),

  cancelInvite: (token: string) => request<void>(`/invites/${token}/cancel`, { method: "POST", auth: true }),

  previewInvite: (token: string) => request<ApiInvitePreview>(`/invites/${token}`),

  acceptInvite: (token: string, payload: { full_name: string; email?: string; password: string }) =>
    request<TokenResponse>(`/invites/${token}/accept`, { method: "POST", body: payload }),

  listAudit: (limit = 50) => request<ApiAuditEntry[]>("/audit", { auth: true, query: { limit: String(limit) } }),

  verifyAuditChain: () => request<ApiAuditVerification>("/audit/verify", { auth: true }),

  listOnboardingVideos: (params: { audience?: ApiVideoAudience; q?: string } = {}) => {
    const query: Record<string, string> = {};
    if (params.audience) query.audience = params.audience;
    if (params.q) query.q = params.q;
    return request<ApiOnboardingVideo[]>("/onboarding/videos", { auth: true, query });
  },

  createOnboardingVideo: (payload: {
    title: string;
    description: string;
    thumbnail_gradient: string;
    media_url?: string;
    audience: ApiVideoAudience;
    duration_seconds: number;
  }) => request<ApiOnboardingVideo>("/onboarding/videos", { method: "POST", body: payload, auth: true }),

  updateOnboardingVideo: (videoId: string, payload: Partial<{ title: string; description: string; audience: ApiVideoAudience }>) =>
    request<ApiOnboardingVideo>(`/onboarding/videos/${videoId}`, { method: "PATCH", body: payload, auth: true }),

  reorderOnboardingVideos: (orderedVideoIds: string[]) =>
    request<ApiOnboardingVideo[]>("/onboarding/videos/reorder", { method: "POST", body: { ordered_video_ids: orderedVideoIds }, auth: true }),

  deleteOnboardingVideo: (videoId: string) => request<void>(`/onboarding/videos/${videoId}`, { method: "DELETE", auth: true }),

  recordOnboardingVideoView: (videoId: string) => request<void>(`/onboarding/videos/${videoId}/view`, { method: "POST", auth: true }),

  shareOnboardingVideo: (videoId: string, payload: { email?: string; user_id?: string }) =>
    request<void>(`/onboarding/videos/${videoId}/share`, { method: "POST", body: payload, auth: true }),

  onboardingAnalytics: () => request<ApiOnboardingAnalytics>("/onboarding/analytics", { auth: true }),
};
