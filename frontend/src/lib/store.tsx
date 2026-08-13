"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AiSuggestedMetadata,
  AlertCase,
  AlertCaseMessage,
  AlertTask,
  AppUser,
  Booking,
  ChatMessage,
  ContentType,
  DashboardAlert,
  EmergencyEvent,
  EmergencyTrigger,
  Incident,
  Invite,
  LoginHistoryEntry,
  Note,
  OnboardingVideo,
  Organisation,
  PersonAlertRule,
  Rag,
  RagAssignment,
  RagDocument,
  RagQuestion,
  RagTestResult,
  Role,
  TeamRole,
  TestFeedback,
  Conversation,
} from "./types";
import {
  INTERNAL_ORG_ID,
  ORG_ID,
  alertCases as seedAlertCases,
  alertCaseMessages as seedAlertCaseMessages,
  alertTasks as seedAlertTasks,
  bookings as seedBookings,
  chatMessages as seedMessages,
  conversations as seedConversations,
  dashboardAlerts as seedAlerts,
  emergencyEvents as seedEmergencyEvents,
  incidents as seedIncidents,
  invites as seedInvites,
  loginHistory as seedLoginHistory,
  onboardingVideos as seedVideos,
  organisations as seedOrgs,
  ragAssignments as seedAssignments,
  ragQuestions as seedQuestions,
  ragTestResults as seedRagTestResults,
  rags as seedRags,
  users as seedUsers,
} from "./mockData";
import { apiClient, clearApiSession, decodeAccessTokenClaims, getAccessToken, hasApiSession } from "./apiClient";
import { mapApiUserToAppUser } from "./apiMapping";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function accessCode(nameHint: string) {
  const initials = nameHint
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${initials}-${num}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

// Rough jitter around Leeds so mock GPS coordinates look plausible without wiring real geolocation.
function mockGps() {
  return { lat: 53.8008 + (Math.random() - 0.5) * 0.08, lng: -1.5491 + (Math.random() - 0.5) * 0.08 };
}

interface AppState {
  currentUserId: string | null;
  // True when currentUserId is a real backend account (see lib/apiClient.ts /
  // hydrateRealAccount), false for demo personas and the mock signup/login
  // paths - lets pages branch between calling the real API and the mock store.
  isRealSession: boolean;
  organisations: Organisation[];
  users: AppUser[];
  invites: Invite[];
  rags: Rag[];
  ragAssignments: RagAssignment[];
  ragQuestions: RagQuestion[];
  dashboardAlerts: DashboardAlert[];
  onboardingVideos: OnboardingVideo[];
  bookings: Booking[];
  loginHistory: LoginHistoryEntry[];
  conversations: Conversation[];
  chatMessages: ChatMessage[];
  notesByUser: Record<string, Note[]>;
  personAlertsByUser: Record<string, PersonAlertRule[]>;
  alertCases: AlertCase[];
  alertCaseMessages: AlertCaseMessage[];
  alertTasks: AlertTask[];
  incidents: Incident[];
  ragTestResults: RagTestResult[];
  emergencyEvents: EmergencyEvent[];
}

function initialState(): AppState {
  return {
    currentUserId: null,
    isRealSession: false,
    organisations: seedOrgs,
    users: seedUsers,
    invites: seedInvites,
    rags: seedRags,
    ragAssignments: seedAssignments,
    ragQuestions: seedQuestions,
    dashboardAlerts: seedAlerts,
    onboardingVideos: seedVideos,
    bookings: seedBookings,
    loginHistory: seedLoginHistory,
    conversations: seedConversations,
    chatMessages: seedMessages,
    notesByUser: {
      "u-aisha": [
        { id: "n-1", authorName: "Morgan Ellis", text: "Completed manual handling refresher on 2026-06-02.", createdAt: "2026-06-02T12:00:00Z" },
      ],
      "u-priya": [],
      "u-tom": [],
      "u-daniel": [],
    },
    personAlertsByUser: {
      "u-priya": [{ id: "pa-1", category: "Missed lone-working check-in", severity: "high", notifyEmail: "morgan.ellis@brightcare.co.uk" }],
    },
    alertCases: seedAlertCases,
    alertCaseMessages: seedAlertCaseMessages,
    alertTasks: seedAlertTasks,
    incidents: seedIncidents,
    ragTestResults: seedRagTestResults,
    emergencyEvents: seedEmergencyEvents,
  };
}

interface AppContextValue extends AppState {
  currentUser: AppUser | null;
  hydrated: boolean;
  login: (email: string, role: Role) => AppUser | null;
  loginAsDemoUser: (userId: string) => void;
  logout: () => void;
  signupOrganisation: (data: { orgName: string; sector: string; name: string; email: string; country: AppUser["country"]; language: AppUser["language"] }) => void;
  signupEmployee: (data: { name: string; email: string; country: AppUser["country"]; language: AppUser["language"] }) => void;
  // Bridges a real backend-authenticated account (see lib/apiClient.ts) into the mock store so the
  // rest of the app's currentUser-driven UI keeps working - the backend doesn't have RAGs/alerts/etc
  // yet, so this is deliberately the only integration seam, not a replacement for the mock data model.
  hydrateRealAccount: (user: AppUser, organisation?: Organisation) => void;

  createInvite: (email: string) => void;
  resendInvite: (inviteId: string) => void;
  cancelInvite: (inviteId: string) => void;
  acceptInviteDemo: (inviteId: string) => void;

  addNote: (userId: string, text: string) => void;
  addPersonAlertRule: (userId: string, rule: Omit<PersonAlertRule, "id">) => void;
  removePersonAlertRule: (userId: string, ruleId: string) => void;
  setTeamRole: (userId: string, teamRole: TeamRole) => void;

  updateOrganisation: (orgId: string, data: { name: string; sector: string }) => void;

  createRag: (name: string, accessPassword: string, category: string, description: string) => Rag;
  publishRag: (ragId: string) => void;
  addDocumentToRag: (
    ragId: string,
    doc: { name: string; sizeKb: number; addedBy: string; addedAt: string; note: string; contentType?: ContentType; aiSuggestion?: AiSuggestedMetadata }
  ) => void;
  updateRagDocumentMetadata: (
    ragId: string,
    docId: string,
    updates: Partial<Pick<RagDocument, "name" | "contentType" | "description" | "appliesTo" | "accessLevel" | "effectiveDate" | "reviewDate" | "owner" | "approvalStatus">>
  ) => void;
  toggleAlertKeyword: (ragId: string, keywordId: string) => void;
  addAlertKeyword: (ragId: string, keyword: string) => void;
  removeAlertKeyword: (ragId: string, keywordId: string) => void;
  setRagEscalationNote: (ragId: string, note: string) => void;
  answerQuestion: (questionId: string, answer: string) => void;
  assignRagToUser: (ragId: string, userId: string, alertOwnerId?: string) => string;
  assignRagToOrg: (ragId: string, orgId: string) => void;

  addRagTestResult: (ragId: string, question: string) => RagTestResult;
  setTestFeedback: (resultId: string, feedback: TestFeedback) => void;

  createBooking: (b: Omit<Booking, "id" | "orgId">) => void;

  toggle2FA: (userId: string) => void;
  toggleIPLock: (userId: string) => void;

  addVideo: (v: Omit<OnboardingVideo, "id" | "order">) => void;

  askRag: (ragId: string, userId: string, question: string, askedViaVoice?: boolean) => RagQuestion;
  activeRagByUser: Record<string, string | null>;
  setActiveRagForUser: (userId: string, ragId: string | null) => void;

  sendChatMessage: (conversationId: string, senderId: string, text: string) => void;
  createGroupConversation: (name: string, memberIds: string[], creatorId: string) => string;
  markAlertRead: (alertId: string) => void;

  sendAlertCaseMessage: (caseId: string, senderId: string, text: string) => void;
  closeAlertCase: (caseId: string, closedBy: string) => void;
  addAlertParticipant: (caseId: string, userId: string) => void;
  addAlertTask: (caseId: string, assigneeId: string, text: string) => void;
  toggleAlertTask: (taskId: string) => void;
  convertAlertToIncident: (caseId: string, investigatorId: string) => Incident;
  closeIncident: (incidentId: string, findings: string) => void;
  flagQuestionAsAlert: (questionId: string, raisedByUserId: string, note?: string) => void;
  askInternalToJoin: (caseId: string) => void;

  triggerEmergency: (userId: string, trigger: EmergencyTrigger, nominatedContact: string) => void;
  resolveEmergency: (eventId: string, resolution: "satisfied" | "escalated") => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const SESSION_KEY = "safeiq-session-user-id";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [activeRagByUser, setActiveRagByUser] = useState<Record<string, string | null>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of session from browser storage on mount
    if (saved) setState((s) => ({ ...s, currentUserId: saved }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (state.currentUserId) sessionStorage.setItem(SESSION_KEY, state.currentUserId);
    else sessionStorage.removeItem(SESSION_KEY);
  }, [state.currentUserId, hydrated]);

  // Real backend sessions (see lib/apiClient.ts) need their own reload recovery: the mock store's
  // seed data resets on every reload (by design, see AGENTS.md), so a real account created via
  // hydrateRealAccount would otherwise resolve to a missing user after a hard refresh even though
  // its access token is still valid. Re-fetches the real profile and re-bridges it, taking
  // precedence over whatever the mock SESSION_KEY above restored.
  useEffect(() => {
    const token = getAccessToken();
    if (!hasApiSession() || !token) return;
    const claims = decodeAccessTokenClaims(token);
    if (!claims) return;

    let cancelled = false;
    apiClient
      .me()
      .then((profile) => {
        if (cancelled) return;
        const user = mapApiUserToAppUser(profile, claims.org_id);
        setState((s) => ({
          ...s,
          users: s.users.some((u) => u.id === user.id) ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user],
          currentUserId: user.id,
          isRealSession: true,
        }));
      })
      .catch(() => clearApiSession());
    return () => {
      cancelled = true;
    };
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const login = useCallback<AppContextValue["login"]>((email, role) => {
    let match = seedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    if (!match) match = seedUsers.find((u) => u.role === role);
    if (!match) return null;
    setState((s) => ({ ...s, currentUserId: match!.id, isRealSession: false }));
    return match;
  }, []);

  const loginAsDemoUser = useCallback((userId: string) => {
    clearApiSession();
    setState((s) => ({ ...s, currentUserId: userId, isRealSession: false }));
  }, []);

  const logout = useCallback(() => {
    clearApiSession();
    setState((s) => ({ ...s, currentUserId: null, isRealSession: false }));
  }, []);

  const signupOrganisation = useCallback<AppContextValue["signupOrganisation"]>((data) => {
    setState((s) => {
      const orgId = id("org");
      const newUser: AppUser = {
        id: id("u"),
        name: data.name,
        email: data.email,
        role: "organisation",
        orgId,
        jobTitle: "Account Owner",
        avatarColor: "#4f46e5",
        country: data.country,
        language: data.language,
        twoFactorEnabled: false,
        ipLockEnabled: false,
        allowedContacts: [],
        directSignUp: true,
        createdAt: nowIso(),
      };
      return {
        ...s,
        organisations: [...s.organisations, { id: orgId, name: data.orgName, sector: data.sector, kycVerified: true }],
        users: [...s.users, newUser],
        currentUserId: newUser.id,
        isRealSession: false,
      };
    });
  }, []);

  const signupEmployee = useCallback<AppContextValue["signupEmployee"]>((data) => {
    setState((s) => {
      const newUser: AppUser = {
        id: id("u"),
        name: data.name,
        email: data.email,
        role: "employee",
        orgId: ORG_ID,
        jobTitle: "New Team Member",
        avatarColor: "#0d9488",
        country: data.country,
        language: data.language,
        twoFactorEnabled: false,
        ipLockEnabled: false,
        allowedContacts: ["u-admin"],
        directSignUp: true,
        createdAt: nowIso(),
      };
      return { ...s, users: [...s.users, newUser], currentUserId: newUser.id, isRealSession: false };
    });
  }, []);

  const hydrateRealAccount = useCallback((user: AppUser, organisation?: Organisation) => {
    setState((s) => {
      const users = s.users.some((u) => u.id === user.id) ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user];
      const organisations = !organisation
        ? s.organisations
        : s.organisations.some((o) => o.id === organisation.id)
          ? s.organisations.map((o) => (o.id === organisation.id ? organisation : o))
          : [...s.organisations, organisation];
      return { ...s, users, organisations, currentUserId: user.id, isRealSession: true };
    });
  }, []);

  const createInvite = useCallback((email: string) => {
    setState((s) => {
      const actingUser = s.users.find((u) => u.id === s.currentUserId);
      const orgId = actingUser?.orgId ?? ORG_ID;
      return {
        ...s,
        invites: [
          { id: id("inv"), email, orgId, status: "pending", magicLink: `https://app.safeiq.io/join/mg-${Math.random().toString(36).slice(2, 8)}`, sentAt: nowIso() },
          ...s.invites,
        ],
      };
    });
  }, []);

  const resendInvite = useCallback((inviteId: string) => {
    setState((s) => ({
      ...s,
      invites: s.invites.map((inv) => (inv.id === inviteId ? { ...inv, sentAt: nowIso() } : inv)),
    }));
  }, []);

  const cancelInvite = useCallback((inviteId: string) => {
    setState((s) => ({
      ...s,
      invites: s.invites.map((inv) => (inv.id === inviteId ? { ...inv, status: "cancelled", respondedAt: nowIso() } : inv)),
    }));
  }, []);

  const acceptInviteDemo = useCallback((inviteId: string) => {
    setState((s) => ({
      ...s,
      invites: s.invites.map((inv) => (inv.id === inviteId ? { ...inv, status: "accepted", respondedAt: nowIso() } : inv)),
    }));
  }, []);

  const addNote = useCallback((userId: string, text: string) => {
    setState((s) => ({
      ...s,
      notesByUser: {
        ...s.notesByUser,
        [userId]: [{ id: id("n"), authorName: "Morgan Ellis", text, createdAt: nowIso() }, ...(s.notesByUser[userId] ?? [])],
      },
    }));
  }, []);

  const addPersonAlertRule = useCallback((userId: string, rule: Omit<PersonAlertRule, "id">) => {
    setState((s) => ({
      ...s,
      personAlertsByUser: {
        ...s.personAlertsByUser,
        [userId]: [...(s.personAlertsByUser[userId] ?? []), { ...rule, id: id("pa") }],
      },
    }));
  }, []);

  const removePersonAlertRule = useCallback((userId: string, ruleId: string) => {
    setState((s) => ({
      ...s,
      personAlertsByUser: {
        ...s.personAlertsByUser,
        [userId]: (s.personAlertsByUser[userId] ?? []).filter((r) => r.id !== ruleId),
      },
    }));
  }, []);

  const setTeamRole = useCallback((userId: string, teamRole: TeamRole) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, teamRole } : u)) }));
  }, []);

  const updateOrganisation = useCallback((orgId: string, data: { name: string; sector: string }) => {
    setState((s) => ({ ...s, organisations: s.organisations.map((o) => (o.id === orgId ? { ...o, ...data } : o)) }));
  }, []);

  const createRag = useCallback((name: string, accessPassword: string, category: string, description: string) => {
    let created: Rag | null = null;
    setState((s) => {
      const actingUser = s.users.find((u) => u.id === s.currentUserId);
      const orgId = actingUser?.role === "internal" ? INTERNAL_ORG_ID : actingUser?.orgId ?? ORG_ID;
      const newRag: Rag = {
        id: id("rag"),
        orgId,
        name,
        accessPassword,
        createdAt: nowIso(),
        createdBy: actingUser?.id ?? "u-admin",
        colorTag: ["#4f46e5", "#0d9488", "#be185d", "#b45309", "#2563eb"][Math.floor(Math.random() * 5)],
        documents: [],
        alertKeywords: [],
        category,
        description,
        status: "draft",
      };
      created = newRag;
      return { ...s, rags: [newRag, ...s.rags] };
    });
    return created as unknown as Rag;
  }, []);

  const publishRag = useCallback((ragId: string) => {
    setState((s) => ({ ...s, rags: s.rags.map((r) => (r.id === ragId ? { ...r, status: "published" } : r)) }));
  }, []);

  const addDocumentToRag = useCallback((ragId: string, doc: Parameters<AppContextValue["addDocumentToRag"]>[1]) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) =>
        r.id === ragId
          ? {
              ...r,
              documents: [
                {
                  id: id("doc"),
                  name: doc.name,
                  sizeKb: doc.sizeKb,
                  addedBy: doc.addedBy,
                  addedAt: doc.addedAt,
                  versions: [{ version: 1, uploadedAt: doc.addedAt, uploadedBy: doc.addedBy, note: doc.note }],
                  contentType: doc.contentType ?? "Other",
                  description: "",
                  appliesTo: "Not confirmed",
                  accessLevel: "everyone",
                  owner: "Not confirmed",
                  approvalStatus: "draft",
                  aiSuggestion: doc.aiSuggestion,
                },
                ...r.documents,
              ],
            }
          : r
      ),
    }));
  }, []);

  const updateRagDocumentMetadata = useCallback(
    (ragId: string, docId: string, updates: Parameters<AppContextValue["updateRagDocumentMetadata"]>[2]) => {
      setState((s) => ({
        ...s,
        rags: s.rags.map((r) =>
          r.id === ragId
            ? { ...r, documents: r.documents.map((d) => (d.id === docId ? { ...d, ...updates, aiSuggestion: undefined } : d)) }
            : r
        ),
      }));
    },
    []
  );

  const toggleAlertKeyword = useCallback((ragId: string, keywordId: string) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) =>
        r.id === ragId
          ? { ...r, alertKeywords: r.alertKeywords.map((k) => (k.id === keywordId ? { ...k, enabled: !k.enabled } : k)) }
          : r
      ),
    }));
  }, []);

  const addAlertKeyword = useCallback((ragId: string, keyword: string) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) =>
        r.id === ragId ? { ...r, alertKeywords: [...r.alertKeywords, { id: id("ak"), keyword, enabled: true }] } : r
      ),
    }));
  }, []);

  const removeAlertKeyword = useCallback((ragId: string, keywordId: string) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) => (r.id === ragId ? { ...r, alertKeywords: r.alertKeywords.filter((k) => k.id !== keywordId) } : r)),
    }));
  }, []);

  const setRagEscalationNote = useCallback((ragId: string, note: string) => {
    setState((s) => ({ ...s, rags: s.rags.map((r) => (r.id === ragId ? { ...r, escalationNote: note } : r)) }));
  }, []);

  const answerQuestion = useCallback((questionId: string, answer: string) => {
    setState((s) => ({
      ...s,
      ragQuestions: s.ragQuestions.map((q) => (q.id === questionId ? { ...q, answer, status: "answered" } : q)),
      dashboardAlerts: s.dashboardAlerts.map((a) =>
        a.ragId && s.ragQuestions.find((q) => q.id === questionId)?.ragId === a.ragId ? { ...a, read: true } : a
      ),
    }));
  }, []);

  const assignRagToUser = useCallback((ragId: string, userId: string, alertOwnerId?: string) => {
    const user = seedUsers.find((u) => u.id === userId);
    const code = accessCode(user?.name ?? "US");
    setState((s) => ({
      ...s,
      ragAssignments: [...s.ragAssignments, { userId, ragId, accessCode: code, assignedAt: nowIso(), alertOwnerId }],
    }));
    return code;
  }, []);

  const assignRagToOrg = useCallback((ragId: string, orgId: string) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) =>
        r.id === ragId ? { ...r, sharedWithOrgIds: [...new Set([...(r.sharedWithOrgIds ?? []), orgId])] } : r
      ),
    }));
  }, []);

  const addRagTestResult = useCallback((ragId: string, question: string) => {
    let created: RagTestResult | null = null;
    setState((s) => {
      const rag = s.rags.find((r) => r.id === ragId);
      const lowerQuestion = question.toLowerCase();
      const matchedKeyword = rag?.alertKeywords.find((k) => k.enabled && lowerQuestion.includes(k.keyword.toLowerCase()));
      const qWords = lowerQuestion.split(/\W+/).filter((w) => w.length > 3);
      const docMatches = rag?.documents.filter((d) => qWords.some((w) => d.name.toLowerCase().includes(w))) ?? [];

      let result: RagTestResult;
      if (matchedKeyword) {
        result = {
          id: id("test"),
          ragId,
          question,
          citedDocumentIds: [],
          confidence: "low",
          conflictFound: false,
          escalationTriggered: true,
          testedAt: nowIso(),
        };
      } else if (docMatches.length > 0) {
        result = {
          id: id("test"),
          ragId,
          question,
          answer: `Based on "${docMatches[0].name}": please refer to that document for the full procedure. (Prototype note: a real deployment would generate a grounded answer from the document text here.)`,
          citedDocumentIds: docMatches.map((d) => d.id),
          confidence: docMatches.length > 1 ? "medium" : "high",
          conflictFound: docMatches.length > 1,
          escalationTriggered: false,
          testedAt: nowIso(),
        };
      } else {
        result = {
          id: id("test"),
          ragId,
          question,
          citedDocumentIds: [],
          confidence: "low",
          conflictFound: false,
          escalationTriggered: true,
          testedAt: nowIso(),
        };
      }
      created = result;
      return { ...s, ragTestResults: [result, ...s.ragTestResults] };
    });
    return created as unknown as RagTestResult;
  }, []);

  const setTestFeedback = useCallback((resultId: string, feedback: TestFeedback) => {
    setState((s) => ({ ...s, ragTestResults: s.ragTestResults.map((r) => (r.id === resultId ? { ...r, feedback } : r)) }));
  }, []);

  const createBooking = useCallback((b: Omit<Booking, "id" | "orgId">) => {
    setState((s) => {
      const actingUser = s.users.find((u) => u.id === s.currentUserId);
      return { ...s, bookings: [...s.bookings, { ...b, id: id("bk"), orgId: actingUser?.orgId ?? ORG_ID }] };
    });
  }, []);

  const toggle2FA = useCallback((userId: string) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, twoFactorEnabled: !u.twoFactorEnabled } : u)) }));
  }, []);

  const toggleIPLock = useCallback((userId: string) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, ipLockEnabled: !u.ipLockEnabled } : u)) }));
  }, []);

  const addVideo = useCallback((v: Omit<OnboardingVideo, "id" | "order">) => {
    setState((s) => ({ ...s, onboardingVideos: [...s.onboardingVideos, { ...v, id: id("v"), order: s.onboardingVideos.length + 1 }] }));
  }, []);

  const askRag = useCallback((ragId: string, userId: string, question: string, askedViaVoice?: boolean) => {
    let created: RagQuestion | null = null;
    setState((s) => {
      const rag = s.rags.find((r) => r.id === ragId);
      const askingUser = s.users.find((u) => u.id === userId);
      const orgId = askingUser?.orgId ?? ORG_ID;
      const lowerQuestion = question.toLowerCase();
      const matchedKeyword = rag?.alertKeywords.find((k) => k.enabled && lowerQuestion.includes(k.keyword.toLowerCase()));

      if (matchedKeyword) {
        const newQuestion: RagQuestion = { id: id("q"), ragId, userId, text: question, status: "escalated", askedAt: nowIso(), askedViaVoice };
        const assignment = s.ragAssignments.find((a) => a.ragId === ragId && a.userId === userId);
        const ownerId = assignment?.alertOwnerId ?? "u-admin";
        const newCase: AlertCase = {
          id: id("case"),
          orgId,
          ragId,
          userId,
          ownerId,
          keyword: matchedKeyword.keyword,
          questionId: newQuestion.id,
          status: "open",
          severity: "high",
          participantIds: [],
          createdAt: nowIso(),
        };
        const newMessage: AlertCaseMessage = { id: id("acm"), caseId: newCase.id, senderId: userId, text: question, sentAt: nowIso() };
        const newAlert: DashboardAlert = {
          id: id("al"),
          orgId,
          title: `Keyword "${matchedKeyword.keyword}" flagged in ${rag?.name ?? "a RAG"}`,
          detail: `"${question}" - opened as an alert case for review.`,
          severity: "high",
          ragId,
          userId,
          createdAt: nowIso(),
          read: false,
        };
        created = newQuestion;
        return {
          ...s,
          ragQuestions: [newQuestion, ...s.ragQuestions],
          alertCases: [newCase, ...s.alertCases],
          alertCaseMessages: [...s.alertCaseMessages, newMessage],
          dashboardAlerts: [newAlert, ...s.dashboardAlerts],
        };
      }

      const qWords = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const priorMatch = s.ragQuestions.find(
        (q) => q.ragId === ragId && q.status === "answered" && qWords.some((w) => q.text.toLowerCase().includes(w))
      );

      if (priorMatch) {
        created = { ...priorMatch, id: id("q"), userId, text: question, askedAt: nowIso(), askedViaVoice };
        return { ...s, ragQuestions: [created, ...s.ragQuestions] };
      }

      const docMatch = rag?.documents.find((d) => qWords.some((w) => d.name.toLowerCase().includes(w)));
      if (docMatch) {
        created = {
          id: id("q"),
          ragId,
          userId,
          text: question,
          answer: `Based on "${docMatch.name}" in this RAG: please refer to that document for the full procedure. (Prototype note: a real deployment would generate a grounded answer from the document text here.)`,
          status: "answered",
          askedAt: nowIso(),
          askedViaVoice,
        };
        return { ...s, ragQuestions: [created, ...s.ragQuestions] };
      }

      created = { id: id("q"), ragId, userId, text: question, status: "pending", askedAt: nowIso(), askedViaVoice };
      const newAlert: DashboardAlert = {
        id: id("al"),
        orgId,
        title: "New question the RAG could not answer",
        detail: `"${question}" - escalated to your organisation for review.`,
        severity: "medium",
        ragId,
        userId,
        createdAt: nowIso(),
        read: false,
      };
      return { ...s, ragQuestions: [created, ...s.ragQuestions], dashboardAlerts: [newAlert, ...s.dashboardAlerts] };
    });
    return created as unknown as RagQuestion;
  }, []);

  const setActiveRagForUser = useCallback((userId: string, ragId: string | null) => {
    setActiveRagByUser((prev) => ({ ...prev, [userId]: ragId }));
  }, []);

  const sendChatMessage = useCallback((conversationId: string, senderId: string, text: string) => {
    setState((s) => ({
      ...s,
      chatMessages: [...s.chatMessages, { id: id("m"), conversationId, senderId, kind: "text", text, sentAt: nowIso() }],
    }));
  }, []);

  const createGroupConversation = useCallback((name: string, memberIds: string[], creatorId: string) => {
    const convId = id("group");
    const participantIds = [...new Set([creatorId, ...memberIds])];
    setState((s) => ({
      ...s,
      conversations: [...s.conversations, { id: convId, participantIds, label: name, isGroup: true }],
    }));
    return convId;
  }, []);

  const markAlertRead = useCallback((alertId: string) => {
    setState((s) => ({ ...s, dashboardAlerts: s.dashboardAlerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)) }));
  }, []);

  const sendAlertCaseMessage = useCallback((caseId: string, senderId: string, text: string) => {
    setState((s) => ({
      ...s,
      alertCaseMessages: [...s.alertCaseMessages, { id: id("acm"), caseId, senderId, text, sentAt: nowIso() }],
    }));
  }, []);

  const closeAlertCase = useCallback((caseId: string, closedBy: string) => {
    setState((s) => ({
      ...s,
      alertCases: s.alertCases.map((c) => (c.id === caseId ? { ...c, status: "closed", closedAt: nowIso(), closedBy } : c)),
    }));
  }, []);

  const addAlertParticipant = useCallback((caseId: string, userId: string) => {
    setState((s) => ({
      ...s,
      alertCases: s.alertCases.map((c) =>
        c.id === caseId && !c.participantIds.includes(userId) ? { ...c, participantIds: [...c.participantIds, userId] } : c
      ),
    }));
  }, []);

  const addAlertTask = useCallback((caseId: string, assigneeId: string, text: string) => {
    setState((s) => ({
      ...s,
      alertTasks: [...s.alertTasks, { id: id("task"), caseId, assigneeId, text, done: false, createdAt: nowIso() }],
    }));
  }, []);

  const toggleAlertTask = useCallback((taskId: string) => {
    setState((s) => ({ ...s, alertTasks: s.alertTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }));
  }, []);

  const convertAlertToIncident = useCallback((caseId: string, investigatorId: string) => {
    let created: Incident | null = null;
    setState((s) => {
      const alertCase = s.alertCases.find((c) => c.id === caseId);
      if (!alertCase) return s;
      const newIncident: Incident = {
        id: id("inc"),
        orgId: alertCase.orgId,
        alertCaseId: caseId,
        ragId: alertCase.ragId,
        subjectUserId: alertCase.userId,
        investigatorId,
        severity: alertCase.severity,
        status: "open",
        openedAt: nowIso(),
      };
      created = newIncident;
      return {
        ...s,
        incidents: [newIncident, ...s.incidents],
        alertCases: s.alertCases.map((c) => (c.id === caseId ? { ...c, incidentId: newIncident.id } : c)),
      };
    });
    return created as unknown as Incident;
  }, []);

  const closeIncident = useCallback((incidentId: string, findings: string) => {
    setState((s) => ({
      ...s,
      incidents: s.incidents.map((i) => (i.id === incidentId ? { ...i, status: "closed", findings, closedAt: nowIso() } : i)),
    }));
  }, []);

  const flagQuestionAsAlert = useCallback((questionId: string, raisedByUserId: string, note?: string) => {
    setState((s) => {
      const question = s.ragQuestions.find((q) => q.id === questionId);
      if (!question) return s;
      const assignment = s.ragAssignments.find((a) => a.ragId === question.ragId && a.userId === question.userId);
      const askingUser = s.users.find((u) => u.id === question.userId);
      const newCase: AlertCase = {
        id: id("case"),
        orgId: askingUser?.orgId ?? ORG_ID,
        ragId: question.ragId,
        userId: question.userId,
        ownerId: assignment?.alertOwnerId ?? "u-admin",
        keyword: "(manually flagged)",
        questionId,
        status: "open",
        severity: "medium",
        participantIds: raisedByUserId !== question.userId ? [raisedByUserId] : [],
        createdAt: nowIso(),
      };
      const newMessage: AlertCaseMessage = {
        id: id("acm"),
        caseId: newCase.id,
        senderId: raisedByUserId,
        text: note?.trim() || `Flagged this answer for review: "${question.text}"`,
        sentAt: nowIso(),
      };
      return { ...s, alertCases: [newCase, ...s.alertCases], alertCaseMessages: [...s.alertCaseMessages, newMessage] };
    });
  }, []);

  const askInternalToJoin = useCallback((caseId: string) => {
    setState((s) => ({
      ...s,
      alertCases: s.alertCases.map((c) =>
        c.id === caseId && !c.participantIds.includes("u-safeiq-internal")
          ? { ...c, participantIds: [...c.participantIds, "u-safeiq-internal"] }
          : c
      ),
      alertCaseMessages: [
        ...s.alertCaseMessages,
        { id: id("acm"), caseId, senderId: "u-safeiq-internal", text: "SafeIQ Internal has been asked to join this alert and will review shortly.", sentAt: nowIso() },
      ],
    }));
  }, []);

  const triggerEmergency = useCallback((userId: string, trigger: EmergencyTrigger, nominatedContact: string) => {
    setState((s) => {
      const user = s.users.find((u) => u.id === userId);
      const gps = mockGps();
      const newEvent: EmergencyEvent = {
        id: id("em"),
        orgId: user?.orgId ?? ORG_ID,
        userId,
        trigger,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        nominatedContact,
        status: "new",
        triggeredAt: nowIso(),
      };
      return { ...s, emergencyEvents: [newEvent, ...s.emergencyEvents] };
    });
  }, []);

  const resolveEmergency = useCallback((eventId: string, resolution: "satisfied" | "escalated") => {
    setState((s) => {
      const event = s.emergencyEvents.find((e) => e.id === eventId);
      if (!event) return s;
      if (resolution === "satisfied") {
        return {
          ...s,
          emergencyEvents: s.emergencyEvents.map((e) => (e.id === eventId ? { ...e, status: "satisfied", resolvedAt: nowIso() } : e)),
        };
      }
      const newCase: AlertCase = {
        id: id("case"),
        orgId: event.orgId,
        ragId: "",
        userId: event.userId,
        ownerId: "u-admin",
        keyword: "(emergency escalation)",
        status: "open",
        severity: "critical",
        participantIds: [],
        createdAt: nowIso(),
      };
      const newMessage: AlertCaseMessage = {
        id: id("acm"),
        caseId: newCase.id,
        senderId: event.userId,
        text: `Emergency (${event.trigger === "safe_word" ? "Emergency Safe Word" : "siren"}) escalated for follow-up.`,
        sentAt: nowIso(),
      };
      return {
        ...s,
        emergencyEvents: s.emergencyEvents.map((e) =>
          e.id === eventId ? { ...e, status: "escalated", resolvedAt: nowIso(), escalatedAlertCaseId: newCase.id } : e
        ),
        alertCases: [newCase, ...s.alertCases],
        alertCaseMessages: [...s.alertCaseMessages, newMessage],
      };
    });
  }, []);

  const value: AppContextValue = {
    ...state,
    currentUser,
    hydrated,
    login,
    loginAsDemoUser,
    logout,
    signupOrganisation,
    signupEmployee,
    hydrateRealAccount,
    createInvite,
    resendInvite,
    cancelInvite,
    acceptInviteDemo,
    addNote,
    addPersonAlertRule,
    removePersonAlertRule,
    setTeamRole,
    updateOrganisation,
    createRag,
    publishRag,
    addDocumentToRag,
    updateRagDocumentMetadata,
    toggleAlertKeyword,
    addAlertKeyword,
    removeAlertKeyword,
    setRagEscalationNote,
    answerQuestion,
    assignRagToUser,
    assignRagToOrg,
    addRagTestResult,
    setTestFeedback,
    createBooking,
    toggle2FA,
    toggleIPLock,
    addVideo,
    askRag,
    activeRagByUser,
    setActiveRagForUser,
    sendChatMessage,
    createGroupConversation,
    markAlertRead,
    sendAlertCaseMessage,
    closeAlertCase,
    addAlertParticipant,
    addAlertTask,
    toggleAlertTask,
    convertAlertToIncident,
    closeIncident,
    flagQuestionAsAlert,
    askInternalToJoin,
    triggerEmergency,
    resolveEmergency,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
