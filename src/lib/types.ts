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
  directSignUp?: boolean; // true if they signed up directly rather than via an invite
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

export type ContentType = "Policy" | "Procedure" | "Guidance" | "Template" | "Regulation" | "FAQ" | "Website" | "Other";
export type ApprovalStatus = "draft" | "awaiting_approval" | "approved" | "archived";
export type AccessLevel = "everyone" | "managers";

export interface AiSuggestedMetadata {
  contentType?: ContentType;
  keywords?: string[];
  possibleDuplicate?: boolean;
  conflictingDocumentId?: string;
}

export interface RagDocument {
  id: string;
  name: string;
  sizeKb: number;
  addedBy: string;
  addedAt: string;
  versions: DocumentVersion[];
  // Knowledge-management metadata (client's redesigned content journey)
  contentType: ContentType;
  description: string;
  appliesTo: string; // free-text service/team/location summary
  accessLevel: AccessLevel;
  effectiveDate?: string; // yyyy-mm-dd
  reviewDate?: string; // yyyy-mm-dd - drives calendar entries
  owner: string; // document owner name
  approvalStatus: ApprovalStatus;
  aiSuggestion?: AiSuggestedMetadata; // shown as "please review and confirm" until metadata is edited
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
  askedViaVoice?: boolean;
}

export interface AlertKeyword {
  id: string;
  keyword: string;
  enabled: boolean;
}

export type TestConfidence = "high" | "medium" | "low";
export type TestFeedback = "correct" | "needs_improvement" | "wrong_source" | "missing_information";

export interface RagTestResult {
  id: string;
  ragId: string;
  question: string;
  answer?: string;
  citedDocumentIds: string[];
  confidence: TestConfidence;
  conflictFound: boolean;
  escalationTriggered: boolean;
  feedback?: TestFeedback;
  testedAt: string;
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
  category: string;
  description: string;
  status: "draft" | "published";
  escalationNote?: string; // what should happen when an alert flags on this RAG
  sharedWithOrgIds?: string[]; // orgs a SafeIQ-Internal-authored RAG has been shared with
}

export type AlertCaseStatus = "open" | "closed";

// Raised when a team member's question matches one of a RAG's alert keywords,
// or is manually flagged from a chat answer. The flagged person and their
// designated alert owner (a manager/support/administrator) converse on it
// here until the owner closes it.
export interface AlertCase {
  id: string;
  orgId: string;
  ragId: string;
  userId: string;
  ownerId: string;
  keyword: string;
  questionId?: string;
  status: AlertCaseStatus;
  severity: AlertSeverity;
  participantIds: string[]; // additional people added to the alert, beyond userId/ownerId
  incidentId?: string; // set once this alert has been turned into an Incident
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

export interface AlertTask {
  id: string;
  caseId: string;
  assigneeId: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export type IncidentStatus = "open" | "closed";

// A full investigation opened from an alert case.
export interface Incident {
  id: string;
  orgId: string;
  alertCaseId: string;
  ragId: string;
  subjectUserId: string;
  investigatorId: string;
  severity: AlertSeverity;
  findings?: string;
  status: IncidentStatus;
  openedAt: string;
  closedAt?: string;
}

export type EmergencyTrigger = "safe_word" | "siren_button";
export type EmergencyStatus = "new" | "active" | "satisfied" | "escalated";

// Created when someone's Emergency Safe Word (or the siren button) fires.
export interface EmergencyEvent {
  id: string;
  orgId: string;
  userId: string;
  trigger: EmergencyTrigger;
  gpsLat: number;
  gpsLng: number;
  nominatedContact: string;
  status: EmergencyStatus;
  triggeredAt: string;
  resolvedAt?: string;
  escalatedAlertCaseId?: string;
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
  isGroup?: boolean;
}
