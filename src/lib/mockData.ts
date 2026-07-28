import type {
  AppUser,
  Booking,
  Conversation,
  ChatMessage,
  DashboardAlert,
  Invite,
  LoginHistoryEntry,
  OnboardingVideo,
  Organisation,
  Rag,
  RagAssignment,
  RagQuestion,
} from "./types";

export const ORG_ID = "org-bright-care";

export const organisations: Organisation[] = [
  {
    id: ORG_ID,
    name: "Bright Care Homes Ltd",
    sector: "Health & Social Care",
    kycVerified: true,
  },
];

export const users: AppUser[] = [
  {
    id: "u-admin",
    name: "Morgan Ellis",
    email: "morgan.ellis@brightcare.co.uk",
    role: "organisation",
    orgId: ORG_ID,
    jobTitle: "Operations Director",
    avatarColor: "#4f46e5",
    country: "United Kingdom",
    language: "English",
    twoFactorEnabled: true,
    ipLockEnabled: false,
    allowedContacts: ["u-aisha", "u-tom", "u-priya", "u-daniel"],
    createdAt: "2026-01-12T09:00:00Z",
  },
  {
    id: "u-aisha",
    name: "Aisha Khan",
    email: "aisha.khan@brightcare.co.uk",
    role: "employee",
    orgId: ORG_ID,
    jobTitle: "Senior Care Worker",
    avatarColor: "#0d9488",
    country: "United Kingdom",
    language: "English",
    twoFactorEnabled: true,
    ipLockEnabled: false,
    allowedContacts: ["u-admin", "u-tom"],
    createdAt: "2026-02-03T09:00:00Z",
  },
  {
    id: "u-tom",
    name: "Tom Green",
    email: "tom.green@brightcare.co.uk",
    role: "employee",
    orgId: ORG_ID,
    jobTitle: "Support Worker",
    avatarColor: "#b45309",
    country: "United Kingdom",
    language: "English",
    twoFactorEnabled: false,
    ipLockEnabled: false,
    allowedContacts: ["u-admin", "u-aisha"],
    createdAt: "2026-03-18T09:00:00Z",
  },
  {
    id: "u-priya",
    name: "Priya Patel",
    email: "priya.patel@brightcare.co.uk",
    role: "employee",
    orgId: ORG_ID,
    jobTitle: "Night Care Lead",
    avatarColor: "#be185d",
    country: "United Kingdom",
    language: "English",
    twoFactorEnabled: true,
    ipLockEnabled: true,
    allowedContacts: ["u-admin"],
    createdAt: "2026-04-02T09:00:00Z",
  },
  {
    id: "u-daniel",
    name: "Daniel Osei",
    email: "daniel.osei@brightcare.co.uk",
    role: "employee",
    orgId: ORG_ID,
    jobTitle: "Domiciliary Care Worker",
    avatarColor: "#2563eb",
    country: "United Kingdom",
    language: "Polish",
    twoFactorEnabled: false,
    ipLockEnabled: false,
    allowedContacts: ["u-admin"],
    createdAt: "2026-05-20T09:00:00Z",
  },
];

export const invites: Invite[] = [
  {
    id: "inv-1",
    email: "sarah.jones@brightcare.co.uk",
    orgId: ORG_ID,
    status: "pending",
    magicLink: "https://app.safeiq.io/join/mg-7f3a9c",
    sentAt: "2026-07-20T10:15:00Z",
  },
  {
    id: "inv-2",
    email: "liam.walsh@brightcare.co.uk",
    orgId: ORG_ID,
    status: "cancelled",
    magicLink: "https://app.safeiq.io/join/mg-2b8e11",
    sentAt: "2026-07-10T14:00:00Z",
    respondedAt: "2026-07-11T09:00:00Z",
  },
  {
    id: "inv-3",
    email: "daniel.osei@brightcare.co.uk",
    orgId: ORG_ID,
    status: "accepted",
    magicLink: "https://app.safeiq.io/join/mg-9d10aa",
    sentAt: "2026-05-19T08:00:00Z",
    respondedAt: "2026-05-20T09:00:00Z",
  },
];

export const rags: Rag[] = [
  {
    id: "rag-safeguarding",
    orgId: ORG_ID,
    name: "Safeguarding Policy 2026",
    accessPassword: "Guard#2026",
    createdAt: "2026-02-10T09:00:00Z",
    createdBy: "u-admin",
    colorTag: "#4f46e5",
    documents: [
      {
        id: "doc-1",
        name: "Safeguarding Adults Policy v3.pdf",
        sizeKb: 842,
        addedBy: "Morgan Ellis",
        addedAt: "2026-02-10T09:10:00Z",
        versions: [
          { version: 1, uploadedAt: "2026-02-10T09:10:00Z", uploadedBy: "Morgan Ellis", note: "Initial upload" },
          { version: 2, uploadedAt: "2026-05-01T11:00:00Z", uploadedBy: "Morgan Ellis", note: "Annual review update" },
          { version: 3, uploadedAt: "2026-07-15T13:20:00Z", uploadedBy: "Morgan Ellis", note: "Added reporting flowchart" },
        ],
      },
      {
        id: "doc-2",
        name: "Reporting a Concern - Flowchart.png",
        sizeKb: 210,
        addedBy: "Morgan Ellis",
        addedAt: "2026-07-15T13:22:00Z",
        versions: [{ version: 1, uploadedAt: "2026-07-15T13:22:00Z", uploadedBy: "Morgan Ellis", note: "Initial upload" }],
      },
    ],
    alertCategories: [
      { id: "ac-1", label: "Suspected abuse or neglect", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
      { id: "ac-2", label: "Client refusing medication", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
      { id: "ac-3", label: "Lone working safety concern", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
      { id: "ac-4", label: "General policy question", enabled: false, notifyEmails: [] },
    ],
  },
  {
    id: "rag-healthsafety",
    orgId: ORG_ID,
    name: "Health & Safety Procedures",
    accessPassword: "SafeSteps!9",
    createdAt: "2026-03-01T09:00:00Z",
    createdBy: "u-admin",
    colorTag: "#0d9488",
    documents: [
      {
        id: "doc-3",
        name: "Manual Handling Guidance.pdf",
        sizeKb: 512,
        addedBy: "Morgan Ellis",
        addedAt: "2026-03-01T09:15:00Z",
        versions: [{ version: 1, uploadedAt: "2026-03-01T09:15:00Z", uploadedBy: "Morgan Ellis", note: "Initial upload" }],
      },
      {
        id: "doc-4",
        name: "COSHH Register.xlsx",
        sizeKb: 96,
        addedBy: "Morgan Ellis",
        addedAt: "2026-06-02T10:00:00Z",
        versions: [
          { version: 1, uploadedAt: "2026-06-02T10:00:00Z", uploadedBy: "Morgan Ellis", note: "Initial upload" },
          { version: 2, uploadedAt: "2026-07-01T10:00:00Z", uploadedBy: "Morgan Ellis", note: "Added new cleaning products" },
        ],
      },
    ],
    alertCategories: [
      { id: "ac-5", label: "Injury on shift", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
      { id: "ac-6", label: "Equipment fault", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
    ],
  },
  {
    id: "rag-careplans",
    orgId: ORG_ID,
    name: "Client Care Plans - Ward A",
    accessPassword: "WardA-Care1",
    createdAt: "2026-04-10T09:00:00Z",
    createdBy: "u-admin",
    colorTag: "#be185d",
    documents: [
      {
        id: "doc-5",
        name: "Care Plan Template.docx",
        sizeKb: 64,
        addedBy: "Morgan Ellis",
        addedAt: "2026-04-10T09:20:00Z",
        versions: [{ version: 1, uploadedAt: "2026-04-10T09:20:00Z", uploadedBy: "Morgan Ellis", note: "Initial upload" }],
      },
    ],
    alertCategories: [
      { id: "ac-7", label: "Change in client condition", enabled: true, notifyEmails: ["morgan.ellis@brightcare.co.uk"] },
      { id: "ac-8", label: "Family complaint", enabled: false, notifyEmails: [] },
    ],
  },
];

export const ragAssignments: RagAssignment[] = [
  { userId: "u-aisha", ragId: "rag-safeguarding", accessCode: "AK-4471-SG", assignedAt: "2026-02-11T09:00:00Z" },
  { userId: "u-aisha", ragId: "rag-careplans", accessCode: "AK-2290-CP", assignedAt: "2026-04-11T09:00:00Z" },
  { userId: "u-tom", ragId: "rag-healthsafety", accessCode: "TG-8834-HS", assignedAt: "2026-03-05T09:00:00Z" },
  { userId: "u-priya", ragId: "rag-safeguarding", accessCode: "PP-1123-SG", assignedAt: "2026-04-03T09:00:00Z" },
  { userId: "u-priya", ragId: "rag-healthsafety", accessCode: "PP-5567-HS", assignedAt: "2026-04-03T09:00:00Z" },
  { userId: "u-daniel", ragId: "rag-careplans", accessCode: "DO-9902-CP", assignedAt: "2026-05-21T09:00:00Z" },
];

export const ragQuestions: RagQuestion[] = [
  {
    id: "q-1",
    ragId: "rag-safeguarding",
    userId: "u-aisha",
    text: "What's the first step if a client discloses abuse to me directly?",
    answer:
      "Stay calm, listen without interrupting, reassure them they did the right thing, do not promise confidentiality, and record exactly what was said using their own words. Report to your line manager within 1 hour using the Safeguarding Concern form (see Reporting a Concern flowchart).",
    status: "answered",
    category: "Suspected abuse or neglect",
    askedAt: "2026-07-21T08:30:00Z",
  },
  {
    id: "q-2",
    ragId: "rag-safeguarding",
    userId: "u-priya",
    text: "Client is refusing evening medication again, what do I log?",
    answer:
      "Record time, medication name/dose, reason given by client, and that you offered it again after 15 minutes. Do not force administration. Notify on-call nurse if refusal continues for 2 consecutive doses.",
    status: "answered",
    category: "Client refusing medication",
    askedAt: "2026-07-22T19:10:00Z",
  },
  {
    id: "q-3",
    ragId: "rag-healthsafety",
    userId: "u-tom",
    text: "The hoist in room 4 is making a grinding noise, can I still use it?",
    status: "pending",
    category: "Equipment fault",
    askedAt: "2026-07-23T07:45:00Z",
  },
  {
    id: "q-4",
    ragId: "rag-careplans",
    userId: "u-daniel",
    text: "Mrs. Whitfield's family are asking why her care plan changed without notice, what do I tell them?",
    status: "escalated",
    category: "Family complaint",
    askedAt: "2026-07-23T09:05:00Z",
  },
  {
    id: "q-5",
    ragId: "rag-safeguarding",
    userId: "u-aisha",
    text: "Am I working alone tonight, and what's the lone-working check-in procedure?",
    answer:
      "Lone workers must check in with the on-call coordinator every 2 hours via the AI agent's status button. If a check-in is missed by more than 15 minutes, the coordinator will attempt contact and may dispatch a welfare visit.",
    status: "answered",
    category: "Lone working safety concern",
    askedAt: "2026-07-20T20:00:00Z",
  },
];

export const dashboardAlerts: DashboardAlert[] = [
  {
    id: "al-1",
    orgId: ORG_ID,
    title: "Family complaint escalated",
    detail: "Daniel Osei's question about Mrs. Whitfield's care plan could not be answered by the RAG and needs a response.",
    severity: "high",
    ragId: "rag-careplans",
    userId: "u-daniel",
    createdAt: "2026-07-23T09:05:00Z",
    read: false,
  },
  {
    id: "al-2",
    orgId: ORG_ID,
    title: "Equipment fault reported",
    detail: "Tom Green flagged a grinding noise from the hoist in room 4. Awaiting maintenance triage.",
    severity: "medium",
    ragId: "rag-healthsafety",
    userId: "u-tom",
    createdAt: "2026-07-23T07:45:00Z",
    read: false,
  },
  {
    id: "al-3",
    orgId: ORG_ID,
    title: "Medication refusal logged",
    detail: "Priya Patel logged a second consecutive medication refusal for a client.",
    severity: "medium",
    ragId: "rag-safeguarding",
    userId: "u-priya",
    createdAt: "2026-07-22T19:12:00Z",
    read: true,
  },
  {
    id: "al-4",
    orgId: ORG_ID,
    title: "New device login",
    detail: "Priya Patel logged in from a new device in Manchester, UK.",
    severity: "low",
    userId: "u-priya",
    createdAt: "2026-07-21T22:40:00Z",
    read: true,
  },
];

export const onboardingVideos: OnboardingVideo[] = [
  { id: "v-1", title: "Welcome to SafeIQ", description: "A 2-minute tour of your organisation dashboard and what to set up first.", thumbnailGradient: "from-indigo-500 to-violet-600", audience: "organisation", order: 1, durationSeconds: 128 },
  { id: "v-2", title: "Creating your first RAG", description: "How to create an isolated RAG system, set an access password, and drop in your first documents.", thumbnailGradient: "from-teal-500 to-emerald-600", audience: "organisation", order: 2, durationSeconds: 205 },
  { id: "v-3", title: "Inviting your team", description: "Send magic-link invites, track who's accepted, and assign RAG access codes.", thumbnailGradient: "from-amber-500 to-orange-600", audience: "organisation", order: 3, durationSeconds: 164 },
  { id: "v-4", title: "Setting up alert categories", description: "Choose which question types should notify your organisation immediately.", thumbnailGradient: "from-rose-500 to-pink-600", audience: "organisation", order: 4, durationSeconds: 142 },
  { id: "v-5", title: "Using the AI agent widget", description: "How the floating AI agent works for you, including switching between assigned RAGs.", thumbnailGradient: "from-sky-500 to-blue-600", audience: "all", order: 5, durationSeconds: 176 },
  { id: "v-6", title: "Your first day as an employee", description: "What to expect: signing in, accepting your invite, and finding your assigned RAGs.", thumbnailGradient: "from-emerald-500 to-teal-600", audience: "employee", order: 6, durationSeconds: 118 },
  { id: "v-7", title: "Switching between RAGs", description: "How to use your unique access code to switch the AI agent onto a different RAG.", thumbnailGradient: "from-fuchsia-500 to-purple-600", audience: "employee", order: 7, durationSeconds: 95 },
  { id: "v-8", title: "Safety features overview", description: "Lock-screen audio recording, the emergency siren, and the voice safe word - what they do and when to use them.", thumbnailGradient: "from-red-500 to-rose-600", audience: "employee", order: 8, durationSeconds: 210 },
  { id: "v-9", title: "Booking time in the calendar", description: "How organisations and employees can book check-ins linked to a specific RAG.", thumbnailGradient: "from-cyan-500 to-teal-600", audience: "all", order: 9, durationSeconds: 88 },
];

export const bookings: Booking[] = [
  {
    id: "bk-1",
    orgId: ORG_ID,
    title: "Fortnightly supervision",
    withUserId: "u-aisha",
    date: "2026-07-24",
    time: "10:00",
    ragId: "rag-safeguarding",
    accessCode: "AK-4471-SG",
    notes: "Review lone-working check-ins.",
  },
  {
    id: "bk-2",
    orgId: ORG_ID,
    title: "Return-to-work check-in",
    withUserId: "u-tom",
    date: "2026-07-25",
    time: "14:30",
    ragId: "rag-healthsafety",
    accessCode: "TG-8834-HS",
  },
  {
    id: "bk-3",
    orgId: ORG_ID,
    title: "Night shift handover review",
    withUserId: "u-priya",
    date: "2026-07-28",
    time: "09:15",
    ragId: "rag-safeguarding",
    accessCode: "PP-1123-SG",
  },
];

export const loginHistory: LoginHistoryEntry[] = [
  { id: "lh-1", userId: "u-admin", ip: "81.174.22.9", location: "Leeds, UK", device: "Chrome on Windows", loginAt: "2026-07-23T08:02:00Z", logoutAt: undefined },
  { id: "lh-2", userId: "u-priya", ip: "92.40.11.3", location: "Manchester, UK", device: "Safari on iPhone", loginAt: "2026-07-21T22:40:00Z", logoutAt: "2026-07-22T06:15:00Z" },
  { id: "lh-3", userId: "u-aisha", ip: "81.174.22.44", location: "Leeds, UK", device: "Chrome on Android", loginAt: "2026-07-21T19:58:00Z", logoutAt: "2026-07-22T07:30:00Z" },
  { id: "lh-4", userId: "u-tom", ip: "86.12.90.201", location: "Bradford, UK", device: "Edge on Windows", loginAt: "2026-07-20T07:55:00Z", logoutAt: "2026-07-20T16:10:00Z" },
  { id: "lh-5", userId: "u-admin", ip: "81.174.22.9", location: "Leeds, UK", device: "Chrome on Windows", loginAt: "2026-07-20T08:00:00Z", logoutAt: "2026-07-20T17:45:00Z" },
];

export const conversations: Conversation[] = [
  { id: "conv-admin-aisha", participantIds: ["u-admin", "u-aisha"], label: "Aisha Khan" },
  { id: "conv-admin-tom", participantIds: ["u-admin", "u-tom"], label: "Tom Green" },
  { id: "conv-aisha-tom", participantIds: ["u-aisha", "u-tom"], label: "Tom Green" },
];

export const chatMessages: ChatMessage[] = [
  { id: "m-1", conversationId: "conv-admin-aisha", senderId: "u-aisha", kind: "text", text: "Morning - all quiet on shift, checking in as scheduled.", sentAt: "2026-07-23T06:02:00Z" },
  { id: "m-2", conversationId: "conv-admin-aisha", senderId: "u-admin", kind: "text", text: "Received, thanks Aisha. Ping me if anything changes with Mrs Whitfield.", sentAt: "2026-07-23T06:05:00Z" },
  { id: "m-3", conversationId: "conv-admin-tom", senderId: "u-tom", kind: "text", text: "Flagged the hoist issue in room 4 via the Health & Safety RAG.", sentAt: "2026-07-23T07:46:00Z" },
];
