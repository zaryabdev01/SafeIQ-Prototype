import type { ApiUserProfile } from "./apiClient";
import type { AppUser, Country, Language } from "./types";

const AVATAR_COLORS = ["#4f46e5", "#0d9488", "#db2777", "#ea580c", "#0891b2", "#7c3aed"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Maps a real backend profile (backend/app/schemas/user.py::UserProfile) onto
 * the mock store's AppUser shape, so pages that only know how to render
 * AppUser (Sidebar, AppShell, the floating widget, etc.) don't need to know
 * a real account is behind it. `country`/`language` are free text on the
 * backend; cast here rather than validated, since in practice this app only
 * ever writes values from lib/constants.ts's own COUNTRIES/LANGUAGES lists.
 */
export function mapApiUserToAppUser(profile: ApiUserProfile, orgId: string): AppUser {
  const isOrgOwner = profile.team_role === "super_admin";
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: isOrgOwner ? "organisation" : "employee",
    teamRole: isOrgOwner ? undefined : (profile.team_role as AppUser["teamRole"]),
    orgId,
    jobTitle: profile.job_title ?? (isOrgOwner ? "Account Owner" : "Team member"),
    avatarColor: colorFor(profile.email),
    country: (profile.country as Country | null) ?? "United Kingdom",
    language: (profile.language as Language | null) ?? "English",
    twoFactorEnabled: false,
    ipLockEnabled: false,
    allowedContacts: [],
    directSignUp: true,
    createdAt: new Date().toISOString(),
  };
}
