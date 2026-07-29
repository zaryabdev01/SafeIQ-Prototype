// "organisation" is the client's Super Admin - the original company sign-up
// account with full control. "internal" is SafeIQ's own staff account, not
// scoped to any one client organisation (preview-only in this prototype).
export type Role = "organisation" | "employee" | "internal";

// Sub-classification for team members (role: "employee"). Organisation accounts
// don't carry a team role. Permissions are not yet differentiated by team role -
// pending the client's answer on what each one should be able to do - this only
// drives labelling and who can be picked as an alert owner for now.
export type TeamRole = "employee" | "manager" | "support" | "administrator";

export type Language = "English" | "Welsh" | "Polish" | "Urdu" | "French";
export type Country = "United Kingdom" | "Ireland" | "France" | "Poland" | "Pakistan";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamRole?: TeamRole;
  orgId: string;
  jobTitle?: string;
  avatarColor: string;
  country: Country;
  language: Language;
  twoFactorEnabled: boolean;
  ipLockEnabled: boolean;
  allowedContacts: string[]; // user ids this person can reach via the AI agent
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  sector: string;
  kycVerified: boolean;
}

export type InviteStatus = "pending" | "accepted" | "cancelled";

export interface Invite {
  id: string;
  email: string;
  orgId: string;
  status: InviteStatus;
  magicLink: string;
  sentAt: string;
  respondedAt?: string;
}

export interface Note {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface PersonAlertRule {
  id: string;
  category: string;
  severity: AlertSeverity;
  notifyEmail: string;
}

export interface RagAssignment {
  userId: string;
  ragId: string;
  accessCode: string;
  assignedAt: string;
  alertOwnerId?: string; // manager/support/administrator who recovers this person's alerts on this RAG
}

export interface DocumentVersion {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  note: string;
}

export interface RagDocument {
  id: string;
  name: string;
  sizeKb: number;
  addedBy: string;
  addedAt: string;
  versions: DocumentVersion[];
}

export type QuestionStatus = "answered" | "pending" | "escalated";

export interface RagQuestion {
  id: string;
  ragId: string;
  userId: string;
  text: string;
  answer?: string;
  status: QuestionStatus;
  category?: string;
  askedAt: string;
}

export interface AlertKeyword {
  id: string;
  keyword: string;
  enabled: boolean;
}

export interface Rag {
  id: string;
  orgId: string;
  name: string;
  accessPassword: string;
  createdAt: string;
  createdBy: string;
  documents: RagDocument[];
  alertKeywords: AlertKeyword[];
  colorTag: string;
}

export type AlertCaseStatus = "open" | "closed";

// Raised when a team member's question matches one of a RAG's alert keywords.
// The flagged person and their designated alert owner (a manager/support/
// administrator) converse on it here until the owner closes it.
export interface AlertCase {
  id: string;
  orgId: string;
  ragId: string;
  userId: string;
  ownerId: string;
  keyword: string;
  questionId?: string;
  status: AlertCaseStatus;
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
}

export interface AlertCaseMessage {
  id: string;
  caseId: string;
  senderId: string;
  text: string;
  sentAt: string;
}

export interface DashboardAlert {
  id: string;
  orgId: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  ragId?: string;
  userId?: string;
  createdAt: string;
  read: boolean;
}

export type VideoAudience = "organisation" | "employee" | "all";

export interface OnboardingVideo {
  id: string;
  title: string;
  description: string;
  thumbnailGradient: string;
  audience: VideoAudience;
  order: number;
  durationSeconds: number;
}

export interface Booking {
  id: string;
  orgId: string;
  title: string;
  withUserId: string;
  date: string; // ISO date (yyyy-mm-dd)
  time: string; // HH:mm
  ragId?: string;
  accessCode?: string;
  notes?: string;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  ip: string;
  location: string;
  device: string;
  loginAt: string;
  logoutAt?: string;
}

export type ChatMessageKind = "text" | "system";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  kind: ChatMessageKind;
  text: string;
  sentAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  label: string;
}
