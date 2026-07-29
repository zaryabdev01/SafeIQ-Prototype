"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AlertCase,
  AlertCaseMessage,
  AppUser,
  Booking,
  ChatMessage,
  DashboardAlert,
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
  Role,
  TeamRole,
  Conversation,
} from "./types";
import {
  ORG_ID,
  alertCases as seedAlertCases,
  alertCaseMessages as seedAlertCaseMessages,
  bookings as seedBookings,
  chatMessages as seedMessages,
  conversations as seedConversations,
  dashboardAlerts as seedAlerts,
  invites as seedInvites,
  loginHistory as seedLoginHistory,
  onboardingVideos as seedVideos,
  organisations as seedOrgs,
  ragAssignments as seedAssignments,
  ragQuestions as seedQuestions,
  rags as seedRags,
  users as seedUsers,
} from "./mockData";

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

interface AppState {
  currentUserId: string | null;
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
}

function initialState(): AppState {
  return {
    currentUserId: null,
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

  createInvite: (email: string) => void;
  resendInvite: (inviteId: string) => void;
  cancelInvite: (inviteId: string) => void;
  acceptInviteDemo: (inviteId: string) => void;

  addNote: (userId: string, text: string) => void;
  addPersonAlertRule: (userId: string, rule: Omit<PersonAlertRule, "id">) => void;
  removePersonAlertRule: (userId: string, ruleId: string) => void;
  setTeamRole: (userId: string, teamRole: TeamRole) => void;

  updateOrganisation: (orgId: string, data: { name: string; sector: string }) => void;

  createRag: (name: string, accessPassword: string) => Rag;
  addDocumentToRag: (ragId: string, doc: Omit<RagDocument, "id" | "versions"> & { note: string }) => void;
  toggleAlertKeyword: (ragId: string, keywordId: string) => void;
  addAlertKeyword: (ragId: string, keyword: string) => void;
  removeAlertKeyword: (ragId: string, keywordId: string) => void;
  answerQuestion: (questionId: string, answer: string) => void;
  assignRagToUser: (ragId: string, userId: string, alertOwnerId?: string) => string;

  createBooking: (b: Omit<Booking, "id" | "orgId">) => void;

  toggle2FA: (userId: string) => void;
  toggleIPLock: (userId: string) => void;

  addVideo: (v: Omit<OnboardingVideo, "id" | "order">) => void;

  askRag: (ragId: string, userId: string, question: string) => RagQuestion;
  activeRagByUser: Record<string, string | null>;
  setActiveRagForUser: (userId: string, ragId: string | null) => void;

  sendChatMessage: (conversationId: string, senderId: string, text: string) => void;
  markAlertRead: (alertId: string) => void;

  sendAlertCaseMessage: (caseId: string, senderId: string, text: string) => void;
  closeAlertCase: (caseId: string, closedBy: string) => void;
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

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const login = useCallback<AppContextValue["login"]>((email, role) => {
    let match = seedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    if (!match) match = seedUsers.find((u) => u.role === role);
    if (!match) return null;
    setState((s) => ({ ...s, currentUserId: match!.id }));
    return match;
  }, []);

  const loginAsDemoUser = useCallback((userId: string) => {
    setState((s) => ({ ...s, currentUserId: userId }));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...s, currentUserId: null }));
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
        createdAt: nowIso(),
      };
      return {
        ...s,
        organisations: [...s.organisations, { id: orgId, name: data.orgName, sector: data.sector, kycVerified: true }],
        users: [...s.users, newUser],
        currentUserId: newUser.id,
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
        createdAt: nowIso(),
      };
      return { ...s, users: [...s.users, newUser], currentUserId: newUser.id };
    });
  }, []);

  const createInvite = useCallback((email: string) => {
    setState((s) => ({
      ...s,
      invites: [
        { id: id("inv"), email, orgId: ORG_ID, status: "pending", magicLink: `https://app.safeiq.io/join/mg-${Math.random().toString(36).slice(2, 8)}`, sentAt: nowIso() },
        ...s.invites,
      ],
    }));
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

  const createRag = useCallback((name: string, accessPassword: string) => {
    const newRag: Rag = {
      id: id("rag"),
      orgId: ORG_ID,
      name,
      accessPassword,
      createdAt: nowIso(),
      createdBy: "u-admin",
      colorTag: ["#4f46e5", "#0d9488", "#be185d", "#b45309", "#2563eb"][Math.floor(Math.random() * 5)],
      documents: [],
      alertKeywords: [],
    };
    setState((s) => ({ ...s, rags: [newRag, ...s.rags] }));
    return newRag;
  }, []);

  const addDocumentToRag = useCallback((ragId: string, doc: Omit<RagDocument, "id" | "versions"> & { note: string }) => {
    setState((s) => ({
      ...s,
      rags: s.rags.map((r) =>
        r.id === ragId
          ? {
              ...r,
              documents: [
                { id: id("doc"), name: doc.name, sizeKb: doc.sizeKb, addedBy: doc.addedBy, addedAt: doc.addedAt, versions: [{ version: 1, uploadedAt: doc.addedAt, uploadedBy: doc.addedBy, note: doc.note }] },
                ...r.documents,
              ],
            }
          : r
      ),
    }));
  }, []);

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

  const createBooking = useCallback((b: Omit<Booking, "id" | "orgId">) => {
    setState((s) => ({ ...s, bookings: [...s.bookings, { ...b, id: id("bk"), orgId: ORG_ID }] }));
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

  const askRag = useCallback((ragId: string, userId: string, question: string) => {
    let created: RagQuestion | null = null;
    setState((s) => {
      const rag = s.rags.find((r) => r.id === ragId);
      const lowerQuestion = question.toLowerCase();
      const matchedKeyword = rag?.alertKeywords.find((k) => k.enabled && lowerQuestion.includes(k.keyword.toLowerCase()));

      if (matchedKeyword) {
        const newQuestion: RagQuestion = { id: id("q"), ragId, userId, text: question, status: "escalated", askedAt: nowIso() };
        const assignment = s.ragAssignments.find((a) => a.ragId === ragId && a.userId === userId);
        const ownerId = assignment?.alertOwnerId ?? "u-admin";
        const newCase: AlertCase = {
          id: id("case"),
          orgId: ORG_ID,
          ragId,
          userId,
          ownerId,
          keyword: matchedKeyword.keyword,
          questionId: newQuestion.id,
          status: "open",
          createdAt: nowIso(),
        };
        const newMessage: AlertCaseMessage = { id: id("acm"), caseId: newCase.id, senderId: userId, text: question, sentAt: nowIso() };
        const newAlert: DashboardAlert = {
          id: id("al"),
          orgId: ORG_ID,
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
        created = { ...priorMatch, id: id("q"), userId, text: question, askedAt: nowIso() };
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
        };
        return { ...s, ragQuestions: [created, ...s.ragQuestions] };
      }

      created = { id: id("q"), ragId, userId, text: question, status: "pending", askedAt: nowIso() };
      const newAlert: DashboardAlert = {
        id: id("al"),
        orgId: ORG_ID,
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

  const value: AppContextValue = {
    ...state,
    currentUser,
    hydrated,
    login,
    loginAsDemoUser,
    logout,
    signupOrganisation,
    signupEmployee,
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
    addDocumentToRag,
    toggleAlertKeyword,
    addAlertKeyword,
    removeAlertKeyword,
    answerQuestion,
    assignRagToUser,
    createBooking,
    toggle2FA,
    toggleIPLock,
    addVideo,
    askRag,
    activeRagByUser,
    setActiveRagForUser,
    sendChatMessage,
    markAlertRead,
    sendAlertCaseMessage,
    closeAlertCase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
