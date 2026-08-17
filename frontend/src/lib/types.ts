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

export type UserStatus = "active" | "archived";

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
  status?: UserStatus; // undefined treated as "active" - only archived members carry an explicit value
  // Client feedback (17/08/2026, gap-analysis §5): a manager can see alert/action
  // summaries without seeing raw conversation content - only a Safeguarding Lead
  // (or the org's Super Admin) can open the full text. Kept as a flag rather than
  // a new TeamRole value since it's a permission, not a job title.
  isSafeguardingLead?: boolean;
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

// Client feedback (17/08/2026, gap-analysis §6): every alert rule should carry a
// scope, provenance, and a change history - display/data-shape only, no real
// notification/escalation logic runs off these fields.
export type AlertRuleScope = "employee" | "global";
export type KeywordScope = "rag" | "global";

export interface AlertRuleChangeLogEntry {
  changedBy: string;
  changedAt: string;
  summary: string;
}

export interface PersonAlertRule {
  id: string;
  category: string;
  severity: AlertSeverity;
  notifyEmail: string;
  scope?: AlertRuleScope; // undefined treated as "employee" (pre-existing rules)
  createdBy?: string;
  createdAt?: string;
  changeLog?: AlertRuleChangeLogEntry[];
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
  severity?: AlertSeverity; // undefined treated as "medium" (pre-existing keywords)
  scope?: KeywordScope; // undefined treated as "rag" (pre-existing keywords)
  createdBy?: string;
  createdAt?: string;
  changeLog?: AlertRuleChangeLogEntry[];
}

export type TestConfidence = "high" | "medium" | "low";
export type TestFeedback = "correct" | "needs_improvement" | "wrong_source" | "missing_information";

// Client feedback (17/08/2026, gap-analysis §7): a new top-level Global Alert
// Library, distinct from per-RAG AlertKeyword and per-employee PersonAlertRule.
// Display/data-shape only - no real notification/escalation logic runs off this.
export type GlobalAlertRuleStatus = "active" | "suggested" | "rejected";

export interface GlobalAlertRule {
  id: string;
  orgId: string;
  phrase: string;
  category: string;
  severity: AlertSeverity;
  ragScope: "all" | string; // "all", or a specific ragId
  recipientRoles: TeamRole[];
  autoCreateAction: boolean;
  acknowledgementRequired: boolean;
  status: GlobalAlertRuleStatus;
  triggeredCount: number;
  proposedBy?: string;
  proposedAt?: string;
  createdBy?: string;
  createdAt?: string;
  changeLog?: AlertRuleChangeLogEntry[];
}

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

// Client feedback (17/08/2026, gap-analysis §5): the client wants the flat
// "keyword matched -> alert" model shown as its real staged pipeline. Display
// only - stage is inferred from existing status/participant data, not driven
// by new detection logic.
export type AlertStage = "keyword_detected" | "signal_generated" | "context_assessment" | "alert_level_set" | "human_review" | "outcome";

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
  context?: string; // e.g. "Describing their own risk" vs "Reporting a concern about someone else"
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

// Client feedback (17/08/2026, gap-analysis §1/§2/§5/§9): a general-purpose,
// standalone Actions entity - referenced by both dashboards, the Team Member
// Profile, and RAG Overview - distinct from AlertTask (which is scoped to one
// alert case only).
export type ActionStatus = "open" | "in_progress" | "completed";
export type ActionPriority = "low" | "medium" | "high" | "urgent";

export interface Action {
  id: string;
  orgId: string;
  ragId?: string;
  assigneeId: string;
  title: string;
  priority: ActionPriority;
  dueAt?: string; // yyyy-mm-dd
  status: ActionStatus;
  sourceAlertCaseId?: string;
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

// Client feedback (17/08/2026, gap-analysis §3): the "Help & Learning Hub"
// redesign - a Help Sprint progression system, card status, category
// taxonomy, and an assignment workflow layered onto the existing (real,
// backend-integrated) onboarding video CMS. All new fields are additive and
// optional so the real Milestone 3 backend path is completely unaffected -
// see frontend/src/app/onboarding/page.tsx's real-mode branch.
export type HelpCardStatus = "recommended" | "next" | "new" | "completed" | "required";
export type HelpCategory = "Getting Started" | "Employees" | "Training" | "Reports" | "Account" | "Billing" | "Troubleshooting" | "General";
export type HelpAudienceType = "org_admin" | "manager" | "employee" | "trainer";
export type ShareChannel = "email" | "whatsapp" | "messenger" | "inplatform" | "team" | "department" | "location";

export interface OnboardingVideo {
  id: string;
  title: string;
  description: string;
  thumbnailGradient: string;
  audience: VideoAudience;
  order: number;
  durationSeconds: number;
  sprintPosition?: number; // 1-9, position in "Your Help Sprint" - undefined means not part of the sprint
  category?: HelpCategory;
  isGeneralSupport?: boolean; // true = "General Support" (account/accessibility/contacting org); undefined/false = "Platform Help"
  userTypes?: HelpAudienceType[]; // undefined treated as all types
  prerequisiteId?: string; // soft "next recommended" dependency, not a hard lock
  estimatedMinutes?: number;
  aiKeywords?: string[];
  published?: boolean; // undefined treated as true (existing items)
  requiredForUserId?: string; // set when an admin assigns this item as "Required" to a specific person
  requiredDueDate?: string; // yyyy-mm-dd
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string; // emoji, avoids a new asset/icon-set dependency
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
  meetingLink?: string;
  cancelled?: boolean;
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
