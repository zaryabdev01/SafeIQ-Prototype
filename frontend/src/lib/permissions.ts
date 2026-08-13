import type { AppUser } from "./types";

// An Administrator is a team member the organisation has promoted to full
// org-console access (create/allocate RAGs, invite people, promote others) -
// per the client's answer, this is the one team role with concretely defined
// capabilities so far. Manager/Support remain plain team members for now,
// distinguished only by being eligible as an alert owner.
export function isOrgLevel(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "organisation" || user.teamRole === "administrator";
}
